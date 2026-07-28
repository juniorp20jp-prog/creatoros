import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InMemoryAnalysisRunRepository,
} from "../persistence";
import {
  TestClock,
  baseAnalysisRunInput,
  createAnalysisResultFixture,
  fixtureAdapterMetadata,
} from "./fixtures/analysis-run-v2-fixtures";

test("new analysis runs start at revision one", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const created = await repository.create(baseAnalysisRunInput);

  assert.equal(created.status, "success");
  if (created.status === "success") {
    assert.equal(created.value.revision, 1);
  }
});

test("every valid state mutation increments the revision", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock([
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:01.000Z",
      "2026-07-20T13:00:02.000Z",
    ]),
  );
  const created = await repository.create(baseAnalysisRunInput);
  assert.equal(created.status, "success");
  if (created.status !== "success") {
    return;
  }

  const processing = await repository.updateStatus(
    created.value.analysisRunId,
    "processing",
    { expectedRevision: 1 },
  );
  assert.equal(processing.status, "success");
  if (processing.status !== "success") {
    return;
  }

  const completed = await repository.complete(
    processing.value.analysisRunId,
    {
      analysisResult: createAnalysisResultFixture(),
      adapterMetadata: fixtureAdapterMetadata,
      adapterWarnings: [],
    },
    { expectedRevision: 2 },
  );

  assert.equal(processing.value.revision, 2);
  assert.equal(completed.status, "success");
  if (completed.status === "success") {
    assert.equal(completed.value.revision, 3);
  }
});

test("a correct expected revision permits the mutation", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
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
    assert.equal(processing.value.revision, 2);
  }
});

test("a stale expected revision returns a typed conflict", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const created = await repository.create(baseAnalysisRunInput);
  assert.equal(created.status, "success");
  if (created.status !== "success") {
    return;
  }

  const conflict = await repository.updateStatus(
    created.value.analysisRunId,
    "processing",
    { expectedRevision: 7 },
  );

  assert.equal(conflict.status, "failure");
  if (conflict.status === "failure") {
    assert.equal(conflict.error.code, "concurrency-conflict");
    assert.equal(conflict.error.expectedRevision, 7);
    assert.equal(conflict.error.actualRevision, 1);
  }
});

test("a concurrency conflict never overwrites the current record", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
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
  if (processing.status !== "success") {
    return;
  }

  const staleCompletion = await repository.complete(
    processing.value.analysisRunId,
    {
      analysisResult: createAnalysisResultFixture(),
      adapterMetadata: fixtureAdapterMetadata,
      adapterWarnings: [],
    },
    { expectedRevision: created.value.revision },
  );
  const stored = await repository.getById(
    processing.value.analysisRunId,
  );

  assert.equal(staleCompletion.status, "failure");
  assert.equal(stored.status, "success");
  if (stored.status === "success") {
    assert.equal(stored.value.status, "processing");
    assert.equal(stored.value.revision, 2);
    assert.equal(stored.value.analysisResult, undefined);
  }
});

test("terminal records remain protected after optimistic updates", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
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
  if (processing.status !== "success") {
    return;
  }
  const failed = await repository.fail(
    processing.value.analysisRunId,
    {
      failure: {
        stage: "pipeline",
        code: "PIPELINE_FAILED",
        message: "Controlled failure.",
      },
    },
    { expectedRevision: processing.value.revision },
  );
  assert.equal(failed.status, "success");
  if (failed.status !== "success") {
    return;
  }

  const reopen = await repository.updateStatus(
    failed.value.analysisRunId,
    "processing",
    { expectedRevision: failed.value.revision },
  );

  assert.equal(reopen.status, "failure");
  if (reopen.status === "failure") {
    assert.equal(reopen.error.code, "invalid-transition");
  }
});
