import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FixtureChannelDataAdapter,
  fixtureChannelData,
} from "../adapters";
import {
  CreatorIntelligenceAnalysisPipeline,
} from "../engines";
import {
  AnalysisRunOrchestrator,
  InMemoryAnalysisRunRepository,
} from "../persistence";
import { FixedIdGenerator } from "./fixtures/core-fixtures";
import { TestClock } from "./fixtures/analysis-run-v2-fixtures";

const repositoryTimes = [
  "2026-07-20T13:00:00.000Z",
  "2026-07-20T13:00:01.000Z",
  "2026-07-20T13:00:02.000Z",
] as const;

function createOrchestrator(
  id = "persisted",
  pipeline = new CreatorIntelligenceAnalysisPipeline(),
) {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(repositoryTimes),
  );
  const adapter = new FixtureChannelDataAdapter(
    new TestClock(["2026-07-20T12:30:00.000Z"]),
  );
  const orchestrator = new AnalysisRunOrchestrator(
    adapter,
    repository,
    pipeline,
    new TestClock(["2026-07-20T12:45:00.000Z"]),
    new FixedIdGenerator(id),
  );

  return {
    orchestrator,
    repository,
  };
}

test("orchestrator persists a successful analysis as completed", async () => {
  const { orchestrator, repository } = createOrchestrator();
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.complete,
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
    correlationId: "correlation_success",
    sourceReference: "fixture:complete",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.analysisRunId, "analysis_run_persisted");
  if (result.status === "completed") {
    assert.equal(result.adapterStatus, "success");
    assert.equal(result.run.status, "completed");
    assert.equal(result.run.schemaVersion, 2);
    assert.equal(result.run.pipelineVersion, "1.0.0");
    assert.equal(
      result.run.analysisResult?.analysisId,
      "analysis_analysis_run_persisted",
    );
    assert.equal(
      result.run.analysisResult?.analyzedAt,
      "2026-07-20T12:45:00.000Z",
    );
    assert.equal(result.run.correlationId, "correlation_success");
    assert.equal(result.run.createdAt, repositoryTimes[0]);
    assert.equal(result.run.updatedAt, repositoryTimes[2]);
    assert.equal(result.run.completedAt, repositoryTimes[2]);
  }

  const persisted = await repository.getById(
    "analysis_run_persisted",
  );
  assert.equal(persisted.status, "success");
  if (persisted.status === "success") {
    assert.deepEqual(persisted.value, result.run);
  }
});

test("orchestrator persists partial adapter output and its warnings", async () => {
  const { orchestrator } = createOrchestrator("partial");
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.partial,
    creatorId: "creator_fixture_partial",
    channelId: "channel_fixture_partial",
  });

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.adapterStatus, "partial");
    assert.equal(result.run.adapterWarnings.length > 0, true);
    assert.equal(
      result.run.analysisResult?.limitations.includes(
        "engagement-data-unavailable",
      ),
      true,
    );
  }
});

test("orchestrator persists a controlled adapter failure and stops the pipeline", async () => {
  class CountingPipeline extends CreatorIntelligenceAnalysisPipeline {
    calls = 0;

    override run(
      ...parameters: Parameters<
        CreatorIntelligenceAnalysisPipeline["run"]
      >
    ) {
      this.calls += 1;
      return super.run(...parameters);
    }
  }

  const pipeline = new CountingPipeline();
  const { orchestrator, repository } = createOrchestrator(
    "adapter_failure",
    pipeline,
  );
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.invalidMetrics,
    creatorId: "creator_fixture_invalid",
    channelId: "channel_fixture_invalid",
  });

  assert.equal(result.status, "failed");
  assert.equal(pipeline.calls, 0);
  if (result.status === "failed") {
    assert.equal(result.stage, "adapter");
    assert.equal(result.run?.status, "failed");
    assert.equal(result.run?.failure?.stage, "adapter");
    assert.equal(
      result.error.code,
      "CHANNEL_DATA_ADAPTER_FAILED",
    );
  }

  const persisted = await repository.getById(
    "analysis_run_adapter_failure",
  );
  assert.equal(persisted.status, "success");
  if (persisted.status === "success") {
    assert.equal(persisted.value.status, "failed");
    assert.equal(persisted.value.analysisResult, undefined);
  }
});

test("orchestrator persists a pipeline failure without fabricating a result", async () => {
  class FailingPipeline extends CreatorIntelligenceAnalysisPipeline {
    override run(): never {
      throw new Error("controlled pipeline failure");
    }
  }

  const { orchestrator } = createOrchestrator(
    "pipeline_failure",
    new FailingPipeline(),
  );
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.complete,
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
  });

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.stage, "pipeline");
    assert.equal(result.error.code, "CREATOR_ANALYSIS_PIPELINE_FAILED");
    assert.equal(result.run?.status, "failed");
    assert.equal(result.run?.analysisResult, undefined);
    assert.equal(
      result.run?.failure?.message,
      "Creator analysis pipeline failed.",
    );
  }
});

test("orchestrator persists an unexpected adapter exception with a safe message", async () => {
  class ThrowingAdapter extends FixtureChannelDataAdapter {
    override adapt(): never {
      throw new Error("secret source payload");
    }
  }

  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(repositoryTimes),
  );
  const orchestrator = new AnalysisRunOrchestrator(
    new ThrowingAdapter(),
    repository,
    new CreatorIntelligenceAnalysisPipeline(),
    new TestClock(["2026-07-20T12:45:00.000Z"]),
    new FixedIdGenerator("adapter_exception"),
  );
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.complete,
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
  });

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.stage, "adapter");
    assert.equal(
      result.error.message,
      "Channel data adapter failed unexpectedly.",
    );
    assert.equal(JSON.stringify(result).includes("secret source payload"), false);
    assert.equal(result.run?.adapterMetadata, undefined);
  }
});

test("orchestrator rejects an adapted identity mismatch", async () => {
  const { orchestrator } = createOrchestrator("identity_mismatch");
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.complete,
    creatorId: "creator_other",
    channelId: "channel_other",
  });

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.stage, "adapter");
    assert.equal(result.error.code, "SOURCE_IDENTITY_MISMATCH");
    assert.equal(result.run?.failure?.stage, "adapter");
  }
});

test("orchestrator preserves caller identifiers, retry metadata, and attempts", async () => {
  const { orchestrator } = createOrchestrator("unused");
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.complete,
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
    analysisRunId: "analysis_run_retry",
    correlationId: "correlation_retry",
    attempt: 2,
    retryOfAnalysisRunId: "analysis_run_original",
  });

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.analysisRunId, "analysis_run_retry");
    assert.equal(result.run.correlationId, "correlation_retry");
    assert.equal(result.run.attempt, 2);
    assert.equal(
      result.run.retryOfAnalysisRunId,
      "analysis_run_original",
    );
  }
});

test("duplicate orchestration is a typed persistence failure and does not overwrite", async () => {
  const { orchestrator, repository } = createOrchestrator();
  const input = {
    sourceData: fixtureChannelData.complete,
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
    analysisRunId: "analysis_run_duplicate",
  };

  const first = await orchestrator.execute(input);
  const second = await orchestrator.execute(input);

  assert.equal(first.status, "completed");
  assert.equal(second.status, "failed");
  if (second.status === "failed") {
    assert.equal(second.stage, "persistence");
    assert.equal(second.error.code, "duplicate-id");
    assert.equal(second.run, undefined);
  }

  const persisted = await repository.getById(
    "analysis_run_duplicate",
  );
  assert.equal(persisted.status, "success");
  if (
    persisted.status === "success" &&
    first.status === "completed"
  ) {
    assert.deepEqual(persisted.value, first.run);
  }
});

test("persisted runs exclude raw source payloads and private source values", async () => {
  const { orchestrator } = createOrchestrator("privacy");
  const result = await orchestrator.execute({
    sourceData: fixtureChannelData.unknownFields,
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
    sourceReference: "fixture:unknown-fields",
  });

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    const serialized = JSON.stringify(result.run);
    assert.equal(serialized.includes("rawChannelData"), false);
    assert.equal(
      serialized.includes("must-not-cross-adapter-boundary"),
      false,
    );
    assert.equal(result.run.source.sourceReference, "fixture:unknown-fields");
  }
});

test("orchestration is deterministic with injected clocks and identifiers", async () => {
  async function execute() {
    const { orchestrator } = createOrchestrator("deterministic");
    return orchestrator.execute({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      correlationId: "correlation_deterministic",
    });
  }

  assert.deepEqual(await execute(), await execute());
});
