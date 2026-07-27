import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANALYSIS_RUN_SCHEMA_VERSION,
  InMemoryAnalysisRunRepository,
  type AnalysisRun,
} from "../persistence";
import {
  TestClock,
  baseAnalysisRunInput,
  createAnalysisResultFixture,
  fixtureAdapterMetadata,
} from "./fixtures/analysis-run-v2-fixtures";

async function createProcessingRun(
  repository: InMemoryAnalysisRunRepository,
  analysisRunId: string,
  channelId = "channel_test",
) {
  const created = await repository.create({
    ...baseAnalysisRunInput,
    analysisRunId,
    channelId,
  });
  assert.equal(created.status, "success");

  const processing = await repository.updateStatus(
    analysisRunId,
    "processing",
  );
  assert.equal(processing.status, "success");
}

test("repository creates and reads a versioned pending run", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const created = await repository.create(baseAnalysisRunInput);
  const read = await repository.getById(
    baseAnalysisRunInput.analysisRunId,
  );

  assert.equal(created.status, "success");
  assert.equal(read.status, "success");
  if (read.status === "success") {
    assert.equal(
      read.value.schemaVersion,
      ANALYSIS_RUN_SCHEMA_VERSION,
    );
    assert.equal(read.value.status, "pending");
    assert.equal(read.value.correlationId, "correlation_test");
    assert.equal(read.value.attempt, 1);
  }
});

test("repository rejects duplicate identifiers without overwriting", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const first = await repository.create(baseAnalysisRunInput);
  const duplicate = await repository.create({
    ...baseAnalysisRunInput,
    creatorId: "different_creator",
  });
  const stored = await repository.getById(
    baseAnalysisRunInput.analysisRunId,
  );

  assert.equal(first.status, "success");
  assert.equal(duplicate.status, "failure");
  if (duplicate.status === "failure") {
    assert.equal(duplicate.error.code, "duplicate-id");
  }
  if (stored.status === "success") {
    assert.equal(stored.value.creatorId, "creator_test");
  }
});

test("repository returns typed not-found results", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );

  const read = await repository.getById("missing");
  const update = await repository.updateStatus(
    "missing",
    "processing",
  );
  const complete = await repository.complete("missing", {
    analysisResult: createAnalysisResultFixture(),
    adapterMetadata: fixtureAdapterMetadata,
    adapterWarnings: [],
  });

  for (const result of [read, update, complete]) {
    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "not-found");
    }
  }
});

test("repository protects ingress and egress with defensive copies", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const input = structuredClone(baseAnalysisRunInput);
  const created = await repository.create(input);
  assert.equal(created.status, "success");

  input.source.sourceType = "mutated-source";
  if (created.status === "success") {
    created.value.source.sourceType = "mutated-return";
  }

  const read = await repository.getById(input.analysisRunId);
  assert.equal(read.status, "success");
  if (read.status === "success") {
    assert.equal(read.value.source.sourceType, "local-fixture");
    read.value.source.sourceType = "mutated-read";
  }

  const readAgain = await repository.getById(input.analysisRunId);
  if (readAgain.status === "success") {
    assert.equal(
      readAgain.value.source.sourceType,
      "local-fixture",
    );
  }
});

test("repository preserves completed analysis with defensive copies", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  await createProcessingRun(repository, "analysis_run_complete");
  const analysis = createAnalysisResultFixture();
  const completed = await repository.complete(
    "analysis_run_complete",
    {
      analysisResult: analysis,
      adapterMetadata: fixtureAdapterMetadata,
      adapterWarnings: [],
    },
  );

  assert.equal(completed.status, "success");
  analysis.channel.id = "mutated_channel";
  if (completed.status === "success") {
    completed.value.analysisResult!.channel.id =
      "mutated_return";
  }

  const stored = await repository.getById(
    "analysis_run_complete",
  );
  if (stored.status === "success") {
    assert.equal(
      stored.value.analysisResult?.channel.id,
      "channel_test",
    );
  }
});

test("repository detects incompatible schema versions on create and read", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const createResult = await repository.create({
    ...baseAnalysisRunInput,
    schemaVersion: 99,
  });
  assert.equal(createResult.status, "failure");
  if (createResult.status === "failure") {
    assert.equal(
      createResult.error.code,
      "version-incompatibility",
    );
  }

  const validRepository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const created = await validRepository.create(
    baseAnalysisRunInput,
  );
  assert.equal(created.status, "success");
  if (created.status !== "success") {
    return;
  }

  const incompatible = {
    ...created.value,
    schemaVersion: 99,
  } as unknown as AnalysisRun;
  const hydratedRepository = new InMemoryAnalysisRunRepository(
    new TestClock(),
    [incompatible],
  );
  const read = await hydratedRepository.getById(
    incompatible.analysisRunId,
  );

  assert.equal(read.status, "failure");
  if (read.status === "failure") {
    assert.equal(
      read.error.code,
      "version-incompatibility",
    );
  }
});

test("repository isolates channel history and returns latest completed", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock([
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:01.000Z",
      "2026-07-20T13:00:02.000Z",
      "2026-07-20T13:01:00.000Z",
      "2026-07-20T13:01:01.000Z",
      "2026-07-20T13:01:02.000Z",
      "2026-07-20T13:02:00.000Z",
    ]),
  );
  await createProcessingRun(repository, "run_old");
  await repository.complete("run_old", {
    analysisResult: createAnalysisResultFixture(),
    adapterMetadata: fixtureAdapterMetadata,
    adapterWarnings: [],
  });
  await createProcessingRun(repository, "run_new");
  await repository.complete("run_new", {
    analysisResult: createAnalysisResultFixture(),
    adapterMetadata: fixtureAdapterMetadata,
    adapterWarnings: [],
  });
  await repository.create({
    ...baseAnalysisRunInput,
    analysisRunId: "other_channel",
    channelId: "channel_other",
  });

  const history = await repository.listByChannel({
    channelId: "channel_test",
  });
  const latest = await repository.latestCompletedByChannel(
    "channel_test",
  );

  if (history.status === "success") {
    assert.deepEqual(
      history.value.items.map((run) => run.analysisRunId),
      ["run_new", "run_old"],
    );
  }
  if (latest.status === "success") {
    assert.equal(latest.value?.analysisRunId, "run_new");
  }
});

test("repository paginates history deterministically with a stable tie-break", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock([
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:00.000Z",
    ]),
  );
  for (const id of ["run_c", "run_a", "run_e", "run_b", "run_d"]) {
    await repository.create({
      ...baseAnalysisRunInput,
      analysisRunId: id,
    });
  }

  const first = await repository.listByChannel({
    channelId: "channel_test",
    limit: 2,
  });
  assert.equal(first.status, "success");
  if (first.status !== "success") {
    return;
  }

  const second = await repository.listByChannel({
    channelId: "channel_test",
    limit: 2,
    cursor: first.value.nextCursor ?? undefined,
  });
  assert.equal(second.status, "success");
  if (second.status !== "success") {
    return;
  }

  const third = await repository.listByChannel({
    channelId: "channel_test",
    limit: 2,
    cursor: second.value.nextCursor ?? undefined,
  });

  assert.deepEqual(
    first.value.items.map((run) => run.analysisRunId),
    ["run_a", "run_b"],
  );
  assert.deepEqual(
    second.value.items.map((run) => run.analysisRunId),
    ["run_c", "run_d"],
  );
  if (third.status === "success") {
    assert.deepEqual(
      third.value.items.map((run) => run.analysisRunId),
      ["run_e"],
    );
    assert.equal(third.value.nextCursor, null);
  }
});

test("repository supports status filters and rejects invalid queries", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  await repository.create({
    ...baseAnalysisRunInput,
    analysisRunId: "pending_run",
  });
  await repository.create({
    ...baseAnalysisRunInput,
    analysisRunId: "processing_run",
  });
  await repository.updateStatus(
    "processing_run",
    "processing",
  );

  const filtered = await repository.listByChannel({
    channelId: "channel_test",
    status: "processing",
  });
  const invalidLimit = await repository.listByChannel({
    channelId: "channel_test",
    limit: 0,
  });
  const invalidCursor = await repository.listByChannel({
    channelId: "channel_test",
    cursor: "missing_cursor",
  });

  if (filtered.status === "success") {
    assert.deepEqual(
      filtered.value.items.map((run) => run.analysisRunId),
      ["processing_run"],
    );
  }
  for (const result of [invalidLimit, invalidCursor]) {
    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "invalid-query");
    }
  }
});

test("repository instances do not share mutable global state", async () => {
  const first = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const second = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  await first.create(baseAnalysisRunInput);

  const firstRead = await first.getById(
    baseAnalysisRunInput.analysisRunId,
  );
  const secondRead = await second.getById(
    baseAnalysisRunInput.analysisRunId,
  );

  assert.equal(firstRead.status, "success");
  assert.equal(secondRead.status, "failure");
});

test("repository maps invalid or throwing clocks to typed persistence failures", async () => {
  const invalidClockRepository = new InMemoryAnalysisRunRepository(
    new TestClock(["not-a-timestamp"]),
  );
  const invalidTimestamp =
    await invalidClockRepository.create(baseAnalysisRunInput);

  assert.equal(invalidTimestamp.status, "failure");
  if (invalidTimestamp.status === "failure") {
    assert.equal(invalidTimestamp.error.code, "persistence-failure");
  }

  const throwingClockRepository = new InMemoryAnalysisRunRepository({
    now(): string {
      throw new Error("clock unavailable");
    },
  });
  const thrownTimestamp =
    await throwingClockRepository.create(baseAnalysisRunInput);

  assert.equal(thrownTimestamp.status, "failure");
  if (thrownTimestamp.status === "failure") {
    assert.equal(thrownTimestamp.error.code, "persistence-failure");
  }
});
