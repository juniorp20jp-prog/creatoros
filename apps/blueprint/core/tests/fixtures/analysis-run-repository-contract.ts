import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AnalysisRunRepository,
} from "../../persistence";
import type { Clock } from "../../services";
import {
  TestClock,
  baseAnalysisRunInput,
  createAnalysisResultFixture,
  fixtureAdapterMetadata,
} from "./analysis-run-v2-fixtures";

export type AnalysisRunRepositoryContractHarness = {
  repository: AnalysisRunRepository;
  cleanup?: () => Promise<void> | void;
};

export type AnalysisRunRepositoryContractFactory = (
  clock: Clock,
) =>
  | AnalysisRunRepositoryContractHarness
  | Promise<AnalysisRunRepositoryContractHarness>;

const clockValues = [
  "2026-07-20T13:00:00.000Z",
  "2026-07-20T13:00:01.000Z",
  "2026-07-20T13:00:02.000Z",
  "2026-07-20T13:01:00.000Z",
  "2026-07-20T13:01:01.000Z",
  "2026-07-20T13:01:02.000Z",
  "2026-07-20T13:02:00.000Z",
  "2026-07-20T13:02:01.000Z",
  "2026-07-20T13:02:02.000Z",
] as const;

async function withRepository(
  factory: AnalysisRunRepositoryContractFactory,
  operation: (repository: AnalysisRunRepository) => Promise<void>,
): Promise<void> {
  const harness = await factory(new TestClock(clockValues));
  try {
    await operation(harness.repository);
  } finally {
    await harness.cleanup?.();
  }
}

async function createProcessing(
  repository: AnalysisRunRepository,
  analysisRunId: string,
) {
  const created = await repository.create({
    ...baseAnalysisRunInput,
    analysisRunId,
  });
  assert.equal(created.status, "success");
  if (created.status !== "success") {
    return assert.fail("Contract setup could not create a run.");
  }

  const processing = await repository.updateStatus(
    analysisRunId,
    "processing",
    { expectedRevision: created.value.revision },
  );
  assert.equal(processing.status, "success");
  return processing.status === "success"
    ? processing.value
    : assert.fail("Contract setup could not transition a run.");
}

export function runAnalysisRunRepositoryContractTests(
  name: string,
  factory: AnalysisRunRepositoryContractFactory,
): void {
  test(`${name}: creates and reads a pending run`, async () => {
    await withRepository(factory, async (repository) => {
      const created = await repository.create(baseAnalysisRunInput);
      assert.equal(created.status, "success");
      if (created.status !== "success") {
        return;
      }
      assert.equal(created.value.status, "pending");
      assert.equal(created.value.revision, 1);

      const read = await repository.getById(
        created.value.analysisRunId,
      );
      assert.equal(read.status, "success");
      if (read.status === "success") {
        assert.deepEqual(read.value, created.value);
      }
    });
  });

  test(`${name}: rejects duplicate identifiers`, async () => {
    await withRepository(factory, async (repository) => {
      await repository.create(baseAnalysisRunInput);
      const duplicate = await repository.create(
        baseAnalysisRunInput,
      );

      assert.equal(duplicate.status, "failure");
      if (duplicate.status === "failure") {
        assert.equal(duplicate.error.code, "duplicate-id");
      }
    });
  });

  test(`${name}: returns typed not-found results`, async () => {
    await withRepository(factory, async (repository) => {
      const read = await repository.getById("missing");
      const update = await repository.updateStatus(
        "missing",
        "processing",
      );

      for (const result of [read, update]) {
        assert.equal(result.status, "failure");
        if (result.status === "failure") {
          assert.equal(result.error.code, "not-found");
        }
      }
    });
  });

  test(`${name}: isolates stored values from caller mutation`, async () => {
    await withRepository(factory, async (repository) => {
      const input = structuredClone(baseAnalysisRunInput);
      const created = await repository.create(input);
      assert.equal(created.status, "success");
      input.source.sourceType = "mutated-input";
      if (created.status === "success") {
        created.value.source.sourceType = "mutated-output";
      }

      const read = await repository.getById(input.analysisRunId);
      assert.equal(read.status, "success");
      if (read.status === "success") {
        assert.equal(read.value.source.sourceType, "local-fixture");
      }
    });
  });

  test(`${name}: supports pending to processing`, async () => {
    await withRepository(factory, async (repository) => {
      const created = await repository.create(baseAnalysisRunInput);
      assert.equal(created.status, "success");
      if (created.status !== "success") {
        return;
      }

      const processing = await repository.updateStatus(
        created.value.analysisRunId,
        "processing",
        { expectedRevision: created.value.revision },
      );
      assert.equal(processing.status, "success");
      if (processing.status === "success") {
        assert.equal(processing.value.status, "processing");
        assert.equal(processing.value.revision, 2);
      }
    });
  });

  test(`${name}: supports processing to completed`, async () => {
    await withRepository(factory, async (repository) => {
      const processing = await createProcessing(
        repository,
        "contract_completed",
      );
      const completed = await repository.complete(
        processing.analysisRunId,
        {
          analysisResult: createAnalysisResultFixture(),
          adapterMetadata: fixtureAdapterMetadata,
          adapterWarnings: [],
        },
        { expectedRevision: processing.revision },
      );

      assert.equal(completed.status, "success");
      if (completed.status === "success") {
        assert.equal(completed.value.status, "completed");
        assert.equal(completed.value.revision, 3);
        assert.ok(completed.value.analysisResult);
      }
    });
  });

  test(`${name}: supports processing to failed`, async () => {
    await withRepository(factory, async (repository) => {
      const processing = await createProcessing(
        repository,
        "contract_failed",
      );
      const failed = await repository.fail(
        processing.analysisRunId,
        {
          failure: {
            stage: "pipeline",
            code: "PIPELINE_FAILED",
            message: "Controlled failure.",
          },
        },
        { expectedRevision: processing.revision },
      );

      assert.equal(failed.status, "success");
      if (failed.status === "success") {
        assert.equal(failed.value.status, "failed");
        assert.equal(failed.value.revision, 3);
        assert.equal(failed.value.failure?.code, "PIPELINE_FAILED");
      }
    });
  });

  test(`${name}: rejects invalid transitions`, async () => {
    await withRepository(factory, async (repository) => {
      const created = await repository.create(baseAnalysisRunInput);
      assert.equal(created.status, "success");
      if (created.status !== "success") {
        return;
      }

      const directComplete = await repository.complete(
        created.value.analysisRunId,
        {
          analysisResult: createAnalysisResultFixture(),
          adapterMetadata: fixtureAdapterMetadata,
          adapterWarnings: [],
        },
        { expectedRevision: created.value.revision },
      );
      assert.equal(directComplete.status, "failure");
      if (directComplete.status === "failure") {
        assert.equal(
          directComplete.error.code,
          "invalid-transition",
        );
      }
    });
  });

  test(`${name}: scopes history to one channel`, async () => {
    await withRepository(factory, async (repository) => {
      await repository.create({
        ...baseAnalysisRunInput,
        analysisRunId: "channel_a",
      });
      await repository.create({
        ...baseAnalysisRunInput,
        analysisRunId: "channel_b",
        channelId: "other_channel",
      });

      const history = await repository.listByChannel({
        channelId: "channel_test",
      });
      assert.equal(history.status, "success");
      if (history.status === "success") {
        assert.deepEqual(
          history.value.items.map((run) => run.analysisRunId),
          ["channel_a"],
        );
      }
    });
  });

  test(`${name}: filters history by status`, async () => {
    await withRepository(factory, async (repository) => {
      await repository.create({
        ...baseAnalysisRunInput,
        analysisRunId: "pending_contract",
      });
      const processing = await repository.create({
        ...baseAnalysisRunInput,
        analysisRunId: "processing_contract",
      });
      assert.equal(processing.status, "success");
      if (processing.status === "success") {
        await repository.updateStatus(
          processing.value.analysisRunId,
          "processing",
          { expectedRevision: processing.value.revision },
        );
      }

      const history = await repository.listByChannel({
        channelId: "channel_test",
        status: "processing",
      });
      assert.equal(history.status, "success");
      if (history.status === "success") {
        assert.deepEqual(
          history.value.items.map((run) => run.analysisRunId),
          ["processing_contract"],
        );
      }
    });
  });

  test(`${name}: returns the latest completed run`, async () => {
    await withRepository(factory, async (repository) => {
      for (const id of ["completed_old", "completed_new"]) {
        const processing = await createProcessing(repository, id);
        await repository.complete(
          id,
          {
            analysisResult: createAnalysisResultFixture(),
            adapterMetadata: fixtureAdapterMetadata,
            adapterWarnings: [],
          },
          { expectedRevision: processing.revision },
        );
      }

      const latest = await repository.latestCompletedByChannel(
        "channel_test",
      );
      assert.equal(latest.status, "success");
      if (latest.status === "success") {
        assert.equal(latest.value?.analysisRunId, "completed_new");
      }
    });
  });

  test(`${name}: paginates with stable ordering`, async () => {
    const harness = await factory(
      new TestClock([
        "2026-07-20T13:00:00.000Z",
        "2026-07-20T13:00:00.000Z",
        "2026-07-20T13:00:00.000Z",
      ]),
    );
    try {
      for (const id of ["run_c", "run_a", "run_b"]) {
        await harness.repository.create({
          ...baseAnalysisRunInput,
          analysisRunId: id,
        });
      }
      const first = await harness.repository.listByChannel({
        channelId: "channel_test",
        limit: 2,
      });
      assert.equal(first.status, "success");
      if (first.status !== "success") {
        return;
      }
      const second = await harness.repository.listByChannel({
        channelId: "channel_test",
        limit: 2,
        cursor: first.value.nextCursor ?? undefined,
      });

      assert.deepEqual(
        first.value.items.map((run) => run.analysisRunId),
        ["run_a", "run_b"],
      );
      assert.equal(second.status, "success");
      if (second.status === "success") {
        assert.deepEqual(
          second.value.items.map((run) => run.analysisRunId),
          ["run_c"],
        );
      }
    } finally {
      await harness.cleanup?.();
    }
  });

  test(`${name}: rejects incompatible schema versions`, async () => {
    await withRepository(factory, async (repository) => {
      const result = await repository.create({
        ...baseAnalysisRunInput,
        schemaVersion: 99,
      });
      assert.equal(result.status, "failure");
      if (result.status === "failure") {
        assert.equal(
          result.error.code,
          "version-incompatibility",
        );
      }
    });
  });

  test(`${name}: protects terminal results from mutation`, async () => {
    await withRepository(factory, async (repository) => {
      const processing = await createProcessing(
        repository,
        "terminal_contract",
      );
      const completed = await repository.complete(
        processing.analysisRunId,
        {
          analysisResult: createAnalysisResultFixture(),
          adapterMetadata: fixtureAdapterMetadata,
          adapterWarnings: [],
        },
        { expectedRevision: processing.revision },
      );
      assert.equal(completed.status, "success");
      if (completed.status !== "success") {
        return;
      }

      const reopened = await repository.updateStatus(
        completed.value.analysisRunId,
        "processing",
        { expectedRevision: completed.value.revision },
      );
      const overwritten = await repository.fail(
        completed.value.analysisRunId,
        {
          failure: {
            stage: "pipeline",
            code: "OVERWRITE",
            message: "Must not be persisted.",
          },
        },
        { expectedRevision: completed.value.revision },
      );

      for (const result of [reopened, overwritten]) {
        assert.equal(result.status, "failure");
        if (result.status === "failure") {
          assert.equal(result.error.code, "invalid-transition");
        }
      }
    });
  });
}
