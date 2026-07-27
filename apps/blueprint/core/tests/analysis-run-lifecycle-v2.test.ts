import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANALYSIS_RUN_TRANSITIONS,
  InMemoryAnalysisRunRepository,
  canTransitionAnalysisRun,
} from "../persistence";
import {
  TestClock,
  baseAnalysisRunInput,
  createAnalysisResultFixture,
  fixtureAdapterMetadata,
} from "./fixtures/analysis-run-v2-fixtures";

test("AnalysisRun lifecycle centralizes the allowed transitions", () => {
  assert.deepEqual(ANALYSIS_RUN_TRANSITIONS, {
    pending: ["processing"],
    processing: ["completed", "failed"],
    completed: [],
    failed: [],
  });
  assert.equal(
    canTransitionAnalysisRun("pending", "processing"),
    true,
  );
  assert.equal(
    canTransitionAnalysisRun("processing", "completed"),
    true,
  );
  assert.equal(
    canTransitionAnalysisRun("processing", "failed"),
    true,
  );
});

test("repository applies pending to processing to completed", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock([
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:01.000Z",
      "2026-07-20T13:00:02.000Z",
    ]),
  );
  const created = await repository.create(baseAnalysisRunInput);
  const processing = await repository.updateStatus(
    baseAnalysisRunInput.analysisRunId,
    "processing",
  );
  const completed = await repository.complete(
    baseAnalysisRunInput.analysisRunId,
    {
      analysisResult: createAnalysisResultFixture(),
      adapterMetadata: fixtureAdapterMetadata,
      adapterWarnings: [],
    },
  );

  assert.equal(created.status, "success");
  assert.equal(
    created.status === "success" && created.value.status,
    "pending",
  );
  assert.equal(processing.status, "success");
  assert.equal(
    processing.status === "success" && processing.value.status,
    "processing",
  );
  assert.equal(completed.status, "success");
  if (completed.status === "success") {
    assert.equal(completed.value.status, "completed");
    assert.equal(
      completed.value.completedAt,
      "2026-07-20T13:00:02.000Z",
    );
  }
});

test("repository applies pending to processing to failed", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock([
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:01.000Z",
      "2026-07-20T13:00:02.000Z",
    ]),
  );
  await repository.create(baseAnalysisRunInput);
  await repository.updateStatus(
    baseAnalysisRunInput.analysisRunId,
    "processing",
  );
  const failed = await repository.fail(
    baseAnalysisRunInput.analysisRunId,
    {
      failure: {
        stage: "adapter",
        code: "ADAPTER_FAILED",
        message: "Fixture validation failed.",
      },
      adapterMetadata: fixtureAdapterMetadata,
    },
  );

  assert.equal(failed.status, "success");
  if (failed.status === "success") {
    assert.equal(failed.value.status, "failed");
    assert.equal(failed.value.failure?.stage, "adapter");
    assert.equal(failed.value.analysisResult, undefined);
  }
});

test("repository rejects direct terminal and repeated transitions", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  await repository.create(baseAnalysisRunInput);

  const directComplete = await repository.complete(
    baseAnalysisRunInput.analysisRunId,
    {
      analysisResult: createAnalysisResultFixture(),
      adapterMetadata: fixtureAdapterMetadata,
      adapterWarnings: [],
    },
  );
  assert.equal(directComplete.status, "failure");
  if (directComplete.status === "failure") {
    assert.equal(
      directComplete.error.code,
      "invalid-transition",
    );
  }

  await repository.updateStatus(
    baseAnalysisRunInput.analysisRunId,
    "processing",
  );
  await repository.fail(baseAnalysisRunInput.analysisRunId, {
    failure: {
      stage: "pipeline",
      code: "PIPELINE_FAILED",
      message: "Pipeline failed.",
    },
  });
  const terminalUpdate = await repository.updateStatus(
    baseAnalysisRunInput.analysisRunId,
    "processing",
  );
  const failedToCompleted = await repository.complete(
    baseAnalysisRunInput.analysisRunId,
    {
      analysisResult: createAnalysisResultFixture(),
      adapterMetadata: fixtureAdapterMetadata,
      adapterWarnings: [],
    },
  );

  assert.equal(terminalUpdate.status, "failure");
  assert.equal(failedToCompleted.status, "failure");
  if (failedToCompleted.status === "failure") {
    assert.equal(
      failedToCompleted.error.code,
      "invalid-transition",
    );
  }
});
