import assert from "node:assert/strict";
import { test } from "node:test";

import {
  executeYouTubeIntelligence,
  interpretCreatorIntelligence,
  type CreatorInsight,
  type CreatorIntelligenceSuccess,
  type EvidenceBlock,
  type EngineExecutionResult,
  type YouTubeIntelligenceOutput,
} from "../index";
import {
  completeYouTubeInput,
  minimalYouTubeInput,
} from "./fixtures/youtube-intelligence-fixtures";

const deterministicRuntimeOptions = {
  correlationId: "creator_intelligence_test",
};

async function completeIntelligence(): Promise<CreatorIntelligenceSuccess> {
  const analytics = await executeYouTubeIntelligence(
    completeYouTubeInput,
    deterministicRuntimeOptions,
  );
  const intelligence = interpretCreatorIntelligence(analytics);
  assert.equal(intelligence.status, "success");
  return intelligence as CreatorIntelligenceSuccess;
}

test("creates a structured Executive Brief from a complete result", async () => {
  const intelligence = await completeIntelligence();

  assert.ok(intelligence.brief.headline.messageKey.startsWith("brief."));
  assert.ok(intelligence.brief.summary.length > 0);
  assert.ok(intelligence.brief.summary.length <= 3);
  assert.equal(intelligence.context.generatedAt, "2026-07-20T12:00:00Z");
});

test("every signal-backed insight preserves traceability and numeric evidence", async () => {
  const intelligence = await completeIntelligence();
  const signalBacked = intelligence.insights.filter(
    (insight) => insight.sourceSignalIds.length > 0,
  );

  assert.ok(signalBacked.length > 0);
  for (const insight of signalBacked) {
    assert.ok(insight.evidence.length > 0);
    assert.ok(insight.sourceSignalIds.length > 0);
    assert.ok(
      insight.evidence.every(
        (evidence) =>
          Number.isFinite(evidence.value) && evidence.sourceRef.length > 0,
      ),
    );
  }
});

test("preserves source evidence values without inventing metrics", async () => {
  const analytics = await executeYouTubeIntelligence(
    completeYouTubeInput,
    deterministicRuntimeOptions,
  );
  assert.equal(analytics.status, "completed");
  if (analytics.status !== "completed") {
    return;
  }

  const intelligence = interpretCreatorIntelligence(analytics);
  assert.equal(intelligence.status, "success");
  if (intelligence.status !== "success") {
    return;
  }

  for (const signal of analytics.output.signals) {
    const insight: CreatorInsight | undefined = intelligence.insights.find((candidate) =>
      candidate.sourceSignalIds.includes(signal.code),
    );
    assert.ok(insight);
    for (const [key, value] of Object.entries(signal.evidence)) {
      assert.equal(
        insight.evidence.find(
          (evidence: EvidenceBlock) =>
            evidence.id === `evidence.signal.${signal.code}.${key}`,
        )?.value,
        value,
      );
    }
  }
});

test("sorts priorities deterministically with stable IDs", async () => {
  const first = await completeIntelligence();
  const second = await completeIntelligence();

  assert.deepEqual(
    first.insights.map((insight) => `${insight.priority}:${insight.id}`),
    second.insights.map((insight) => `${insight.priority}:${insight.id}`),
  );
  const ranks = { high: 0, medium: 1, low: 2 } as const;
  assert.deepEqual(
    first.insights.map((insight) => ranks[insight.priority]),
    [...first.insights]
      .map((insight) => ranks[insight.priority])
      .sort((left, right) => left - right),
  );
});

test("does not emit causal, predictive, or recommendation prose", async () => {
  const intelligence = await completeIntelligence();
  const serialized = JSON.stringify(intelligence);

  assert.doesNotMatch(serialized, /guaranteed|will succeed|caused by/i);
  assert.equal("recommendations" in intelligence, false);
});

test("copies confidence and leaves unavailable confidence unevaluated", async () => {
  const intelligence = await completeIntelligence();
  for (const insight of intelligence.insights) {
    if (insight.sourceSignalIds.length === 0) {
      assert.equal(insight.confidence, null);
    } else {
      assert.ok(["low", "medium", "high"].includes(insight.confidence ?? ""));
    }
  }
});

test("represents partial data with a visible data-quality insight", async () => {
  const partialInput = {
    ...completeYouTubeInput,
    channel: {
      id: completeYouTubeInput.channel.id,
      name: completeYouTubeInput.channel.name,
      subscribers: completeYouTubeInput.channel.subscribers,
    },
    videos: completeYouTubeInput.videos.map((video) => ({
      id: video.id,
      title: video.title,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
      views: video.views,
    })),
  };
  const analytics = await executeYouTubeIntelligence(
    partialInput,
    deterministicRuntimeOptions,
  );
  const intelligence = interpretCreatorIntelligence(analytics);

  assert.equal(intelligence.status, "success");
  if (intelligence.status === "success") {
    assert.equal(intelligence.quality.status, "partial");
    assert.ok(
      intelligence.insights.some(
        (insight) => insight.category === "data-quality",
      ),
    );
  }
});

test("prioritizes insufficient samples without inventing conclusions", async () => {
  const analytics = await executeYouTubeIntelligence(
    minimalYouTubeInput,
    deterministicRuntimeOptions,
  );
  const intelligence = interpretCreatorIntelligence(analytics);

  assert.equal(intelligence.status, "success");
  if (intelligence.status === "success") {
    assert.equal(intelligence.brief.status, "limited");
    assert.equal(intelligence.quality.status, "limited");
    assert.equal(intelligence.insights[0]?.category, "data-quality");
    assert.equal(intelligence.insights[0]?.confidence, null);
  }
});

test("supports a valid result with zero insights", async () => {
  const analytics = await executeYouTubeIntelligence(
    completeYouTubeInput,
    deterministicRuntimeOptions,
  );
  assert.equal(analytics.status, "completed");
  if (analytics.status !== "completed") {
    return;
  }

  const withoutInsights: EngineExecutionResult<YouTubeIntelligenceOutput> = {
    ...analytics,
    output: {
      ...analytics.output,
      signals: [],
    },
  };
  const intelligence = interpretCreatorIntelligence(withoutInsights);

  assert.equal(intelligence.status, "success");
  if (intelligence.status === "success") {
    assert.deepEqual(intelligence.insights, []);
    assert.ok(
      intelligence.brief.summary.some(
        (statement) =>
          statement.messageKey === "brief.summary.noSupportedInsights",
      ),
    );
    assert.equal(intelligence.brief.confidence, null);
  }
});

test("maps analytical validation failures to a discriminated failure", async () => {
  const video = minimalYouTubeInput.videos[0]!;
  const analytics = await executeYouTubeIntelligence({
    ...minimalYouTubeInput,
    videos: [video, video],
  });
  const intelligence = interpretCreatorIntelligence(analytics);

  assert.deepEqual(
    intelligence.status === "failure"
      ? [intelligence.reason, intelligence.errorCode]
      : null,
    ["invalid-analytics-result", "YOUTUBE_INTELLIGENCE_VALIDATION_FAILED"],
  );
});

test("controls incompatible completed results without throwing", async () => {
  const analytics = await executeYouTubeIntelligence(
    completeYouTubeInput,
    deterministicRuntimeOptions,
  );
  const incompatible = {
    ...analytics,
    status: "completed",
    output: null,
  } as unknown as EngineExecutionResult<YouTubeIntelligenceOutput>;
  const intelligence = interpretCreatorIntelligence(incompatible);

  assert.equal(intelligence.status, "failure");
  if (intelligence.status === "failure") {
    assert.equal(intelligence.reason, "incompatible-input");
  }
});

test("does not modify the analytical execution result", async () => {
  const analytics = await executeYouTubeIntelligence(
    completeYouTubeInput,
    deterministicRuntimeOptions,
  );
  const snapshot = JSON.stringify(analytics);

  interpretCreatorIntelligence(analytics);

  assert.equal(JSON.stringify(analytics), snapshot);
});

test("brief statements use stable keys, parameters, and valid evidence refs", async () => {
  const intelligence = await completeIntelligence();
  const evidenceIds = new Set(
    intelligence.evidence.map((evidence) => evidence.id),
  );

  for (const statement of [
    intelligence.brief.headline,
    ...intelligence.brief.summary,
  ]) {
    assert.ok(statement.id.length > 0);
    assert.ok(statement.messageKey.length > 0);
    assert.equal(typeof statement.parameters, "object");
    assert.ok(statement.evidenceRefs.every((id) => evidenceIds.has(id)));
  }
});

test("emits only categories justified by signals or data quality", async () => {
  const intelligence = await completeIntelligence();
  const categories = new Set(
    intelligence.insights.map((insight) => insight.category),
  );

  assert.ok(categories.has("opportunity"));
  assert.ok(categories.has("risk"));
  assert.ok(categories.has("pattern"));
  assert.ok(categories.has("finding"));
  assert.equal(categories.has("data-quality"), false);
});
