import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREATOR_ANALYSIS_PIPELINE_STEPS,
  CREATOR_INTELLIGENCE_ENGINE_ID,
  CreatorIntelligenceAnalysisPipeline,
  CreatorIntelligenceEngine,
  DefaultChannelDataNormalizer,
  DefaultChannelMetricsCalculator,
  DefaultOpportunityEngine,
  DefaultRecommendationEngine,
  DefaultScoreEngine,
  EngineRegistry,
  type ChannelDataNormalizer,
  type ChannelMetricsCalculator,
  type OpportunityEngine,
  type RecommendationEngine,
  type ScoreEngine,
} from "../index";
import type { CoreEngineContracts } from "../runtime";
import {
  DefaultExecutionContextFactory,
  EngineRuntime,
} from "../services";
import {
  FixedIdGenerator,
  SequenceClock,
  creatorInputWithoutSources,
} from "./fixtures/core-fixtures";
import { completeRawChannelData } from "./fixtures/creator-intelligence-analysis-fixtures";

const pipelineContext = {
  analysisId: "analysis_test",
  analyzedAt: "2026-07-20T13:00:00.000Z",
};

test("analysis pipeline executes every decoupled stage in order", () => {
  const calls: string[] = [];
  const normalizer: ChannelDataNormalizer = {
    normalize(input, context) {
      calls.push("normalization");
      return new DefaultChannelDataNormalizer().normalize(
        input,
        context,
      );
    },
  };
  const metricsCalculator: ChannelMetricsCalculator = {
    calculate(input) {
      calls.push("metrics");
      return new DefaultChannelMetricsCalculator().calculate(input);
    },
  };
  const scoreEngine: ScoreEngine = {
    calculate(input) {
      calls.push("scores");
      return new DefaultScoreEngine().calculate(input);
    },
  };
  const opportunityEngine: OpportunityEngine = {
    find(input) {
      calls.push("opportunities");
      return new DefaultOpportunityEngine().find(input);
    },
  };
  const recommendationEngine: RecommendationEngine = {
    recommend(input) {
      calls.push("recommendations");
      return new DefaultRecommendationEngine().recommend(input);
    },
  };
  const result = new CreatorIntelligenceAnalysisPipeline(
    normalizer,
    metricsCalculator,
    scoreEngine,
    opportunityEngine,
    recommendationEngine,
  ).run(completeRawChannelData, pipelineContext);

  assert.deepEqual(calls, CREATOR_ANALYSIS_PIPELINE_STEPS);
  assert.deepEqual(
    result.completedStepIds,
    CREATOR_ANALYSIS_PIPELINE_STEPS,
  );
});

test("analysis pipeline produces deterministic metrics, scores and limitations", () => {
  const pipeline = new CreatorIntelligenceAnalysisPipeline();
  const inputSnapshot = structuredClone(completeRawChannelData);
  const first = pipeline.run(
    completeRawChannelData,
    pipelineContext,
  );
  const second = pipeline.run(
    completeRawChannelData,
    pipelineContext,
  );

  assert.deepEqual(first, second);
  assert.deepEqual(completeRawChannelData, inputSnapshot);
  assert.equal(first.analysis.metrics.analyzedViews, 900);
  assert.equal(
    first.analysis.metrics.averageEngagementRate,
    6,
  );
  assert.equal(
    first.analysis.scores.map((score) => score.kind).join(","),
    "content,consistency,optimization,growth",
  );
  assert.deepEqual(first.analysis.opportunities, []);
  assert.deepEqual(first.analysis.recommendations, []);
  assert.deepEqual(first.analysis.limitations, [
    "deterministic-foundation-no-external-analysis",
  ]);
});

test("registered Creator Intelligence Engine runs the analysis pipeline", async () => {
  const registry = new EngineRegistry<CoreEngineContracts>();
  registry.register(new CreatorIntelligenceEngine());
  const runtime = new EngineRuntime(
    registry,
    new DefaultExecutionContextFactory(
      new SequenceClock([
        "2026-07-20T13:00:00.000Z",
        "2026-07-20T13:00:01.000Z",
        "2026-07-20T13:00:02.000Z",
      ]),
      new FixedIdGenerator("analysis"),
    ),
  );

  const result = await runtime.execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    {
      ...creatorInputWithoutSources,
      rawChannelData: completeRawChannelData,
    },
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.readiness, "analysis-completed");
    assert.equal(
      result.output.analysis?.analysisId,
      "analysis_exec_analysis",
    );
    assert.equal(
      result.output.analysis?.analyzedAt,
      "2026-07-20T13:00:01.000Z",
    );
    assert.deepEqual(
      result.metadata.completedStepIds,
      CREATOR_ANALYSIS_PIPELINE_STEPS,
    );
    assert.equal(
      result.metadata.finishedAt,
      "2026-07-20T13:00:02.000Z",
    );
  }
});

test("registered engine returns a controlled failure for incompatible creator data", async () => {
  const registry = new EngineRegistry<CoreEngineContracts>();
  registry.register(new CreatorIntelligenceEngine());
  const runtime = new EngineRuntime(registry);
  const result = await runtime.execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    {
      ...creatorInputWithoutSources,
      rawChannelData: {
        ...completeRawChannelData,
        creator: {
          id: "different_creator",
        },
      },
    },
  );

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(
      result.error.code,
      "CREATOR_INTELLIGENCE_EXECUTION_FAILED",
    );
    assert.match(result.error.message, /must match/);
  }
});
