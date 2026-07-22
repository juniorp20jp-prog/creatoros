import assert from "node:assert/strict";
import { test } from "node:test";

import {
  average,
  calculateChannelEngagement,
  calculatePublicationFrequency,
  calculateSubscriberImpact,
  calculateVideoEngagement,
  calculateViewConcentration,
  classifyRelativePerformance,
  median,
} from "../engines/youtube-intelligence/statistics";
import type { YouTubeVideoInput } from "../engines/youtube-intelligence/types";

const baseVideo: YouTubeVideoInput = {
  id: "video",
  title: "Video",
  publishedAt: "2026-01-01T00:00:00Z",
  durationSeconds: 100,
  views: 100,
};

test("YouTube statistics calculate average and median", () => {
  assert.equal(average([100, 200, 300, 1000]), 400);
  assert.equal(median([100, 200, 300, 1000]), 250);
  assert.equal(median([300, 100, 200]), 200);
  assert.equal(average([]), 0);
  assert.equal(median([]), 0);
});

test("publication frequency uses ordered UTC intervals", () => {
  const frequency = calculatePublicationFrequency([
    "2026-01-15T00:00:00Z",
    "2026-01-01T00:00:00Z",
    "2026-01-08T00:00:00Z",
  ]);

  assert.deepEqual(frequency.intervalsDays, [7, 7]);
  assert.equal(frequency.averageIntervalDays, 7);
  assert.equal(frequency.medianIntervalDays, 7);
  assert.equal(frequency.coefficientOfVariation, 0);
  assert.equal(frequency.videosPer30Days, 60 / 14);
});

test("relative classification honors documented boundary ratios", () => {
  assert.equal(classifyRelativePerformance(74, 100, 4), "below-median");
  assert.equal(classifyRelativePerformance(75, 100, 4), "near-median");
  assert.equal(classifyRelativePerformance(124, 100, 4), "near-median");
  assert.equal(classifyRelativePerformance(125, 100, 4), "above-median");
  assert.equal(classifyRelativePerformance(199, 100, 4), "above-median");
  assert.equal(classifyRelativePerformance(200, 100, 4), "exceptional");
  assert.equal(classifyRelativePerformance(100, 100, 1), "near-median");
});

test("engagement uses only available metrics and requires positive views", () => {
  assert.deepEqual(
    calculateVideoEngagement({ ...baseVideo, likes: 10 }),
    {
      rate: 0.1,
      interactions: 10,
      includedMetrics: ["likes"],
      partial: true,
    },
  );
  assert.equal(calculateVideoEngagement({ ...baseVideo, views: 0, likes: 1 }), undefined);
  assert.equal(calculateVideoEngagement(baseVideo), undefined);
});

test("channel engagement is weighted by eligible views", () => {
  const result = calculateChannelEngagement([
    { ...baseVideo, id: "one", views: 100, likes: 10, comments: 0 },
    { ...baseVideo, id: "two", views: 900, likes: 9 },
    { ...baseVideo, id: "three", views: 0, likes: 100 },
    { ...baseVideo, id: "four", views: 500 },
  ]);

  assert.equal(result.rate, 19 / 1000);
  assert.equal(result.interactions, 19);
  assert.equal(result.eligibleViews, 1000);
  assert.equal(result.eligibleVideoCount, 2);
  assert.equal(result.partiallyMeasuredVideoCount, 1);
});

test("subscriber impact is distinct from historical growth", () => {
  const result = calculateSubscriberImpact([
    { ...baseVideo, id: "one", views: 1000, subscribersGained: 10 },
    { ...baseVideo, id: "two", views: 3000, subscribersGained: 30 },
    { ...baseVideo, id: "three", views: 500 },
  ]);

  assert.deepEqual(result, {
    totalSubscribersGained: 40,
    averageSubscribersGainedPerEligibleVideo: 20,
    subscribersGainedPerThousandViews: 10,
    eligibleVideoCount: 2,
  });
});

test("view concentration uses top-one and top-three shares", () => {
  assert.deepEqual(calculateViewConcentration([600, 200, 100, 100]), {
    topVideoShare: 0.6,
    topThreeShare: 0.9,
    videosIncludedInTopThree: 3,
    limitedSample: false,
  });
  assert.equal(calculateViewConcentration([10, 5]).limitedSample, true);
  assert.equal(calculateViewConcentration([0, 0]).topVideoShare, undefined);
});
