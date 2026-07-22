import assert from "node:assert/strict";
import { test } from "node:test";

import {
  YOUTUBE_INTELLIGENCE_ENGINE_ID,
  coreEngineRegistry,
  executeYouTubeIntelligence,
  type YouTubeIntelligenceInput,
} from "../index";
import {
  completeYouTubeInput,
  minimalYouTubeInput,
} from "./fixtures/youtube-intelligence-fixtures";

function emptyYouTubeInput(): YouTubeIntelligenceInput {
  return {
    ...minimalYouTubeInput,
    videos: [],
  };
}

test("YouTube Intelligence is registered through the Core public API", () => {
  assert.equal(coreEngineRegistry.has(YOUTUBE_INTELLIGENCE_ENGINE_ID), true);
  assert.equal(
    coreEngineRegistry
      .list()
      .some((definition) => definition.id === YOUTUBE_INTELLIGENCE_ENGINE_ID),
    true,
  );
});

test("YouTube Intelligence executes through the official runtime", async () => {
  const result = await executeYouTubeIntelligence(minimalYouTubeInput, {
    correlationId: "youtube_test",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.metadata.engineId, YOUTUBE_INTELLIGENCE_ENGINE_ID);
  assert.equal(result.metadata.providerIds.length, 0);
});

test("empty channels return a valid partial analysis", async () => {
  const result = await executeYouTubeIntelligence(emptyYouTubeInput());

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.summary.analyzedVideoCount, 0);
    assert.equal(result.output.summary.totalViews, 0);
    assert.equal(result.output.summary.coveredPeriod, undefined);
    assert.deepEqual(result.output.videos, []);
    assert.deepEqual(result.output.signals, []);
    assert.equal(result.output.dataQuality.effectiveVideoCount, 0);
    assert.ok(result.output.dataQuality.unevaluatedSignals.length > 0);
  }
});

test("minimal data remains minimal and does not invent optional metrics", async () => {
  const result = await executeYouTubeIntelligence(minimalYouTubeInput);

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.summary.averageViews, 100);
    assert.equal(result.output.summary.medianViews, 100);
    assert.equal(result.output.summary.engagement.rate, undefined);
    assert.equal(
      result.output.summary.subscriberImpact.totalSubscribersGained,
      undefined,
    );
    assert.deepEqual(result.output.videos[0]?.availableMetrics, [
      "views",
      "durationSeconds",
    ]);
    assert.deepEqual(result.output.videos[0]?.derivedMetrics, {});
    assert.equal(result.output.videos[0]?.classification, "near-median");
    assert.equal(
      result.output.dataQuality.fields.absent.includes("videos.ctr"),
      true,
    );
    const insufficientSampleCodes = result.output.dataQuality.unevaluatedSignals
      .filter((signal) => signal.reason === "insufficient-sample")
      .map((signal) => signal.code);
    assert.deepEqual(insufficientSampleCodes, [
      "publication-inconsistency",
      "view-concentration",
      "above-median-performance",
      "publication-frequency-change",
      "duration-performance-association",
      "recurring-title-terms",
    ]);
    const unavailableMetricCodes = result.output.dataQuality.unevaluatedSignals
      .filter((signal) => signal.reason === "metric-unavailable")
      .map((signal) => signal.code);
    assert.deepEqual(unavailableMetricCodes, [
      "relative-high-ctr",
      "relative-low-ctr",
      "relative-high-retention",
      "relative-low-retention",
      "relative-high-engagement",
      "relative-low-engagement",
    ]);
  }
});

test("complete metrics produce deterministic channel and video summaries", async () => {
  const first = await executeYouTubeIntelligence(completeYouTubeInput);
  const second = await executeYouTubeIntelligence(completeYouTubeInput);

  assert.equal(first.status, "completed");
  assert.equal(second.status, "completed");
  if (first.status === "completed" && second.status === "completed") {
    assert.deepEqual(first.output, second.output);
    assert.equal(first.output.summary.totalViews, 10_000);
    assert.equal(first.output.summary.averageViews, 1250);
    assert.equal(first.output.summary.medianViews, 600);
    assert.equal(first.output.summary.averageVideoDurationSeconds, 510);
    assert.equal(first.output.summary.engagement.rate, 1186 / 10_000);
    assert.equal(
      first.output.summary.subscriberImpact.totalSubscribersGained,
      200,
    );
    assert.equal(
      first.output.summary.subscriberImpact
        .subscribersGainedPerThousandViews,
      20,
    );
    assert.equal(first.output.videos[7]?.classification, "exceptional");
    assert.equal(first.output.context, completeYouTubeInput.context);
    assert.deepEqual(first.output.dataQuality.fields.partiallyAvailable, []);
    assert.deepEqual(first.output.dataQuality.fields.absent, []);
    assert.ok(
      first.output.dataQuality.limitations.includes(
        "historical-channel-growth-unavailable-without-subscriber-history",
      ),
    );
  }
});

test("complete data generates only evidence-backed deterministic signals", async () => {
  const result = await executeYouTubeIntelligence(completeYouTubeInput);

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    const codes = result.output.signals.map((signal) => signal.code);
    assert.ok(codes.includes("publication-inconsistency"));
    assert.ok(codes.includes("view-concentration"));
    assert.ok(codes.includes("above-median-performance"));
    assert.ok(codes.includes("relative-high-ctr"));
    assert.ok(codes.includes("relative-low-retention"));
    assert.ok(codes.includes("duration-performance-association"));
    assert.ok(codes.includes("recurring-title-terms"));

    for (const signal of result.output.signals) {
      assert.ok(Object.keys(signal.evidence).length > 0);
      assert.ok(["low", "medium", "high"].includes(signal.confidence));
      assert.ok(signal.relatedVideoIds.length > 0);
    }
  }
});

test("view concentration records exact top shares", async () => {
  const views = [600, 200, 100, 100];
  const input: YouTubeIntelligenceInput = {
    ...minimalYouTubeInput,
    videos: views.map((videoViews, index) => ({
      ...minimalYouTubeInput.videos[0]!,
      id: `concentration_${index}`,
      publishedAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
      views: videoViews,
    })),
  };
  const result = await executeYouTubeIntelligence(input);

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    const signal = result.output.signals.find(
      (item) => item.code === "view-concentration",
    );
    assert.equal(signal?.evidence.topVideoShare, 0.6);
    assert.equal(signal?.evidence.topThreeShare, 0.9);
    assert.notEqual(signal?.impact, "high");
  }
});

test("out-of-period videos are excluded from summary and data quality tracks them", async () => {
  const input: YouTubeIntelligenceInput = {
    ...minimalYouTubeInput,
    videos: [
      ...minimalYouTubeInput.videos,
      {
        ...minimalYouTubeInput.videos[0]!,
        id: "outside",
        publishedAt: "2025-12-01T12:00:00Z",
        views: 9999,
      },
    ],
  };
  const result = await executeYouTubeIntelligence(input);

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.summary.totalViews, 100);
    assert.equal(result.output.dataQuality.inputVideoCount, 2);
    assert.equal(result.output.dataQuality.effectiveVideoCount, 1);
    assert.deepEqual(result.output.dataQuality.excludedVideos, [
      { videoId: "outside", reason: "outside-requested-period" },
    ]);
  }
});

test("invalid inputs return a discriminated validation failure", async () => {
  const duplicate = minimalYouTubeInput.videos[0]!;
  const result = await executeYouTubeIntelligence({
    ...minimalYouTubeInput,
    videos: [duplicate, duplicate],
  });

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.error.code, "YOUTUBE_INTELLIGENCE_VALIDATION_FAILED");
    assert.equal(result.error.retryable, false);
  }
});

test("YouTube Intelligence output has no recommendations", async () => {
  const result = await executeYouTubeIntelligence(completeYouTubeInput);

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal("recommendations" in result.output, false);
    assert.equal(
      result.output.summary.historicalChannelGrowth.status,
      "not-calculable",
    );
  }
});
