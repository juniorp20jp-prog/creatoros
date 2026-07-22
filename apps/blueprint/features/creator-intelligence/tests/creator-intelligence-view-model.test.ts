import assert from "node:assert/strict";
import { test } from "node:test";

import {
  executeYouTubeIntelligence,
  interpretCreatorIntelligence,
  type CreatorIntelligenceResult,
} from "../../../core";
import { youtubeAnalyzerScenarios } from "../../youtube-analyzer/fixtures";
import { createCreatorIntelligenceViewModel } from "../model";

async function createScenarioResult(
  scenarioId: "complete" | "partial" | "insufficient" | "invalid",
) {
  const analytics = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios[scenarioId],
    {
      correlationId: `view_model_${scenarioId}`,
    },
  );
  return interpretCreatorIntelligence(analytics);
}

test("groups high-priority and additional insights without changing their order", async () => {
  const result = await createScenarioResult("complete");
  const viewModel = createCreatorIntelligenceViewModel("complete", result);

  assert.equal(viewModel.state, "success");
  if (viewModel.state === "success") {
    assert.ok(
      viewModel.priorityInsights.every(
        (insight) => insight.priority === "high",
      ),
    );
    assert.ok(
      viewModel.additionalInsights.every(
        (insight) => insight.priority !== "high",
      ),
    );
    const sourceOrder =
      result.status === "success"
        ? result.insights.map((insight) => insight.id)
        : [];
    assert.deepEqual(
      [
        ...viewModel.priorityInsights,
        ...viewModel.additionalInsights,
      ].map((insight) => insight.id),
      sourceOrder,
    );
  }
});

test("maps partial and insufficient quality to explicit UI states", async () => {
  const partial = createCreatorIntelligenceViewModel(
    "partial",
    await createScenarioResult("partial"),
  );
  const insufficient = createCreatorIntelligenceViewModel(
    "insufficient",
    await createScenarioResult("insufficient"),
  );

  assert.equal(partial.state, "partial-data");
  assert.equal(insufficient.state, "insufficient-sample");
});

test("preserves unevaluated confidence as null", async () => {
  const viewModel = createCreatorIntelligenceViewModel(
    "insufficient",
    await createScenarioResult("insufficient"),
  );

  assert.equal(viewModel.state, "insufficient-sample");
  if (viewModel.state === "insufficient-sample") {
    const qualityInsight = [
      ...viewModel.priorityInsights,
      ...viewModel.additionalInsights,
    ].find((insight) => insight.category === "data-quality");
    assert.equal(qualityInsight?.confidence, null);
    assert.equal(viewModel.brief.confidence, null);
  }
});

test("keeps quality, evidence, and limitations visible", async () => {
  const result = await createScenarioResult("partial");
  const viewModel = createCreatorIntelligenceViewModel("partial", result);

  assert.equal(viewModel.state, "partial-data");
  if (viewModel.state === "partial-data" && result.status === "success") {
    assert.equal(viewModel.quality, result.quality);
    assert.equal(viewModel.evidence, result.evidence);
    assert.equal(viewModel.limitations, result.limitations);
    assert.ok(viewModel.quality.insufficientMetricCount > 0);
  }
});

test("represents a valid result with no insights", async () => {
  const result = await createScenarioResult("complete");
  assert.equal(result.status, "success");
  if (result.status !== "success") {
    return;
  }
  const withoutInsights: CreatorIntelligenceResult = {
    ...result,
    insights: [],
    brief: {
      ...result.brief,
      confidence: null,
    },
  };
  const viewModel = createCreatorIntelligenceViewModel(
    "complete",
    withoutInsights,
  );

  assert.equal(viewModel.state, "success");
  if (viewModel.state === "success") {
    assert.equal(viewModel.hasInsights, false);
    assert.deepEqual(viewModel.priorityInsights, []);
    assert.deepEqual(viewModel.additionalInsights, []);
    assert.equal(viewModel.brief.confidence, null);
  }
});

test("maps validation and controlled failures without exposing raw errors", async () => {
  const invalid = createCreatorIntelligenceViewModel(
    "invalid",
    await createScenarioResult("invalid"),
  );
  const unexpected = createCreatorIntelligenceViewModel("complete", {
    status: "failure",
    reason: "unexpected-error",
    errorCode: "CONTROLLED_FAILURE",
    messageKey: "states.failures.unexpected-error",
    metadata: {
      sourceEngineId: "youtube-intelligence",
      sourceExecutionId: "controlled",
      generatedAt: null,
      interpreterVersion: "1.0.0",
    },
  });

  assert.equal(invalid.state, "validation-error");
  assert.equal(unexpected.state, "unexpected-error");
  assert.equal("stack" in invalid, false);
  assert.equal("stack" in unexpected, false);
});

test("does not modify the Creator Intelligence result", async () => {
  const result = await createScenarioResult("complete");
  const snapshot = JSON.stringify(result);

  createCreatorIntelligenceViewModel("complete", result);

  assert.equal(JSON.stringify(result), snapshot);
});

test("produces deterministic presentation sections", async () => {
  const result = await createScenarioResult("complete");
  assert.deepEqual(
    createCreatorIntelligenceViewModel("complete", result),
    createCreatorIntelligenceViewModel("complete", result),
  );
});
