import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryYouTubeAnalyticsRepository, YOUTUBE_ANALYTICS_METRICS, periodDates, projectChannelAnalytics, projectVideoAnalytics } from "../index";

const AS_OF = "2026-09-12T12:00:00.000Z";
const values = { views: "100", estimatedMinutesWatched: "50.5", averageViewDuration: "30.25", averageViewPercentage: "42.5", subscribersGained: "4", subscribersLost: "1", likes: "8", comments: "2", shares: "1" } as const;

test("Analytics periods are bounded to 7, 30, or 90 calendar days", () => {
  assert.deepEqual(periodDates("7d", AS_OF), { requestedStartDate: "2026-09-06", requestedEndDate: "2026-09-12" });
  assert.deepEqual(periodDates("90d", AS_OF), { requestedStartDate: "2026-06-15", requestedEndDate: "2026-09-12" });
});

test("channel projection preserves decimals, derives net subscribers, and reports processing latency", () => {
  const result = projectChannelAnalytics({ period: "30d", asOf: AS_OF, effectiveDataThrough: "2026-09-10", rows: [{ batchId: "batch", metricDate: "2026-09-10", values, availableFields: YOUTUBE_ANALYTICS_METRICS }] });
  assert.equal(result.values.estimatedMinutesWatched, "50.5");
  assert.equal(result.values.netSubscribers, "3");
  assert.equal(result.freshness, "processing");
});

test("channel projection preserves large decimal counters without Number precision loss", () => {
  const result = projectChannelAnalytics({
    period: "30d",
    asOf: AS_OF,
    rows: [
      { batchId: "batch", metricDate: "2026-09-09", values: { views: "99999999999999999999.125", averageViewDuration: "0.1" }, availableFields: ["views", "averageViewDuration"] },
      { batchId: "batch", metricDate: "2026-09-10", values: { views: "0.875", averageViewDuration: "0.2" }, availableFields: ["views", "averageViewDuration"] },
    ],
  });
  assert.equal(result.values.views, "100000000000000000000");
  assert.equal(result.values.averageViewDuration, "0.15");
});

test("missing metrics remain absent rather than becoming zero", () => {
  const result = projectChannelAnalytics({ period: "7d", asOf: AS_OF, rows: [{ batchId: "batch", metricDate: "2026-09-10", values: { views: "0" }, availableFields: ["views"] }] });
  assert.equal(result.values.views, "0");
  assert.equal(result.values.averageViewDuration, undefined);
  assert.ok(result.missingFields.includes("averageViewDuration"));
});

test("video projection aggregates only compatible persisted rows", () => {
  const result = projectVideoAnalytics([{ batchId: "a", videoId: "video", metricDate: "2026-09-09", values, availableFields: YOUTUBE_ANALYTICS_METRICS }, { batchId: "a", videoId: "video", metricDate: "2026-09-10", values: { views: "25", subscribersGained: "1", subscribersLost: "0" }, availableFields: ["views", "subscribersGained", "subscribersLost"] }]);
  assert.equal(result[0]?.values.views, "125");
  assert.equal(result[0]?.values.netSubscribers, "4");
  assert.equal(result[0]?.observedDays, 2);
});

test("immutable collections preserve old batches while latest-per-day projection wins", async () => {
  const repository = new InMemoryYouTubeAnalyticsRepository();
  const base = { userId: "user", channelId: "channel", requestedStartDate: "2026-09-01", requestedEndDate: "2026-09-12", effectiveDataThrough: "2026-09-10", outcome: "completed" as const, availableFields: ["views" as const], missingFields: YOUTUBE_ANALYTICS_METRICS.filter((metric) => metric !== "views"), channelRowCount: 1, videoRowCount: 0, videoCoverageCount: 0, videoCoverageLimit: 50 };
  await repository.persist({ batch: { ...base, batchId: "a", collectedAt: "2026-09-11T00:00:00.000Z" }, channel: [{ batchId: "a", metricDate: "2026-09-10", values: { views: "10" }, availableFields: ["views"] }], videos: [] });
  await repository.persist({ batch: { ...base, batchId: "b", collectedAt: "2026-09-12T00:00:00.000Z" }, channel: [{ batchId: "b", metricDate: "2026-09-10", values: { views: "12" }, availableFields: ["views"] }], videos: [] });
  const projection = await repository.getChannelProjection("user", "30d", AS_OF);
  assert.equal(projection.status, "success");
  if (projection.status === "success") assert.equal(projection.value.values.views, "12");
  assert.equal((await repository.persist({ batch: { ...base, batchId: "a", collectedAt: AS_OF }, channel: [], videos: [] })).status, "failure");
});

test("repository projections enforce user ownership", async () => {
  const repository = new InMemoryYouTubeAnalyticsRepository();
  const result = await repository.getChannelProjection("other-user", "30d", AS_OF);
  assert.equal(result.status, "success");
  if (result.status === "success") assert.equal(result.value.availability, "no-data");
});
