import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FixtureChannelDataAdapter,
  executeAdaptedChannelAnalysis,
  fixtureChannelData,
} from "../adapters";
import {
  CREATOR_ANALYSIS_PIPELINE_STEPS,
  CreatorIntelligenceAnalysisPipeline,
} from "../engines/creator-intelligence";
import type { Clock } from "../services";

class FixedClock implements Clock {
  now(): string {
    return "2026-07-20T13:00:00.000Z";
  }
}

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

const adapter = new FixtureChannelDataAdapter(new FixedClock());
const context = {
  analysisId: "analysis_adapter_test",
  analyzedAt: "2026-07-20T13:00:00.000Z",
};

test("adapter to pipeline integration produces an AnalysisResult", () => {
  const result = executeAdaptedChannelAnalysis(
    fixtureChannelData.complete,
    adapter,
    context,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.adapterResult.status, "success");
    assert.equal(result.analysis.analysisId, context.analysisId);
    assert.equal(result.analysis.metrics.analyzedViews, 900);
    assert.equal(
      result.analysis.metrics.averageEngagementRate,
      6,
    );
    assert.deepEqual(
      result.completedStepIds,
      CREATOR_ANALYSIS_PIPELINE_STEPS,
    );
  }
});

test("adapter to pipeline integration continues with partial data and warnings", () => {
  const result = executeAdaptedChannelAnalysis(
    fixtureChannelData.partial,
    adapter,
    context,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.adapterResult.status, "partial");
    assert.equal(result.adapterResult.warnings.length > 0, true);
    assert.equal(
      result.analysis.metrics.averageEngagementRate,
      undefined,
    );
    assert.equal(
      result.analysis.limitations.includes(
        "engagement-data-unavailable",
      ),
      true,
    );
  }
});

test("adapter to pipeline integration preserves the no-videos state", () => {
  const result = executeAdaptedChannelAnalysis(
    fixtureChannelData.noVideos,
    adapter,
    context,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.analysis.metrics.analyzedVideoCount, 0);
    assert.equal(
      result.analysis.limitations.includes("no-videos-provided"),
      true,
    );
  }
});

test("adapter failure stops before the pipeline", () => {
  const pipeline = new CountingPipeline();
  const result = executeAdaptedChannelAnalysis(
    fixtureChannelData.invalidMetrics,
    adapter,
    context,
    pipeline,
  );

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.stage, "adapter");
  }
  assert.equal(pipeline.calls, 0);
});

test("unknown fields produce warnings without coupling the pipeline to source data", () => {
  const result = executeAdaptedChannelAnalysis(
    fixtureChannelData.unknownFields,
    adapter,
    context,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.adapterResult.status, "partial");
    assert.equal(
      result.analysis.channel.id,
      "channel_fixture_complete",
    );
    assert.equal(
      "providerRanking" in result.analysis.channel,
      false,
    );
  }
});

test("adapter to pipeline integration is deterministic", () => {
  const first = executeAdaptedChannelAnalysis(
    fixtureChannelData.complete,
    adapter,
    context,
  );
  const second = executeAdaptedChannelAnalysis(
    fixtureChannelData.complete,
    adapter,
    context,
  );

  assert.deepEqual(first, second);
});
