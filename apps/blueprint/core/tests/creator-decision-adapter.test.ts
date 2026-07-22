import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptYouTubeIntelligenceToDecisionInput,
  generateCreatorDecisionsFromYouTubeAnalytics,
} from "../decisions/creator-decision-engine";
import { YouTubeIntelligenceEngine } from "../engines/youtube-intelligence";
import { interpretCreatorIntelligence } from "../intelligence/creator-intelligence";
import type {
  EngineExecutionContext,
  EngineExecutionResult,
} from "../types";
import { completeYouTubeInput } from "./fixtures/youtube-intelligence-fixtures";

const context: EngineExecutionContext = {
  executionId: "exec-decision-adapter",
  engineId: "youtube-intelligence",
  startedAt: "2026-07-20T12:00:00Z",
  locale: "es",
  attributes: {},
  now: () => "2026-07-20T12:00:00Z",
};

async function analyticsResult() {
  return new YouTubeIntelligenceEngine().execute(completeYouTubeInput, context);
}

test("the adapter converts existing analytics into normalized creator signals", async () => {
  const analytics = await analyticsResult();
  const intelligence = interpretCreatorIntelligence(analytics);
  const adapted = adaptYouTubeIntelligenceToDecisionInput(
    analytics,
    intelligence,
  );
  assert.equal(adapted.status, "completed");
  if (adapted.status !== "completed") {
    return;
  }

  assert.equal(adapted.input.creatorId, completeYouTubeInput.channel.id);
  assert.ok(adapted.input.signals.length > 0);
  assert.ok(
    adapted.input.signals.some(
      (signal) => signal.dimension === "click-through-performance",
    ),
  );
  assert.ok(
    adapted.input.signals.every(
      (signal) => signal.magnitude >= 0 && signal.magnitude <= 1,
    ),
  );
  assert.equal(adapted.input.sourceMetadata?.platform, "youtube");
});

test("YouTube-specific metadata stays in the adapter boundary", async () => {
  const analytics = await analyticsResult();
  const adapted = adaptYouTubeIntelligenceToDecisionInput(
    analytics,
    interpretCreatorIntelligence(analytics),
  );
  assert.equal(adapted.status, "completed");
  if (adapted.status !== "completed") {
    return;
  }

  assert.ok(
    adapted.input.signals.every(
      (signal) => !signal.dimension.toLowerCase().includes("youtube"),
    ),
  );
  assert.ok(
    adapted.input.insights.every(
      (insight) => !insight.category.toLowerCase().includes("youtube"),
    ),
  );
});

test("the adapter preserves partial availability instead of inventing missing data", async () => {
  const analytics = await analyticsResult();
  assert.equal(analytics.status, "completed");
  if (analytics.status !== "completed") {
    return;
  }
  const partialAnalytics: typeof analytics = {
    ...analytics,
    output: {
      ...analytics.output,
      dataQuality: {
        ...analytics.output.dataQuality,
        fields: {
          completelyAvailable: ["views"],
          partiallyAvailable: ["ctr"],
          absent: ["retention", "subscribersGained"],
        },
      },
    },
  };
  const adapted = adaptYouTubeIntelligenceToDecisionInput(
    partialAnalytics,
    interpretCreatorIntelligence(partialAnalytics),
  );
  assert.equal(adapted.status, "completed");
  if (adapted.status !== "completed") {
    return;
  }
  assert.equal(adapted.input.context.dataAvailability, 0.375);
});

test("the adapter returns a clear failure when analytics execution failed", () => {
  const failed: EngineExecutionResult<never> = {
    status: "failed",
    error: { code: "SOURCE_FAILED", message: "failed", retryable: false },
    metadata: {
      executionId: "exec-failed",
      engineId: "youtube-intelligence",
      startedAt: context.startedAt,
      finishedAt: context.startedAt,
      providerIds: [],
      completedStepIds: [],
    },
  };
  const adapted = adaptYouTubeIntelligenceToDecisionInput(
    failed,
    interpretCreatorIntelligence(failed),
  );
  assert.deepEqual(adapted, {
    status: "failed",
    reason: "analytics-failed",
    errorCode: "SOURCE_FAILED",
  });
});

test("the public integration generates decisions from the existing analytics result", async () => {
  const result = generateCreatorDecisionsFromYouTubeAnalytics(
    await analyticsResult(),
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }
  assert.ok(result.decisions.length > 0);
  assert.ok(
    result.decisions.every(
      (decision) => decision.sourceMetadata?.platform === "youtube",
    ),
  );
});

