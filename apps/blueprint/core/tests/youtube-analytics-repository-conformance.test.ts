import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryYouTubeAnalyticsRepository,
  YOUTUBE_ANALYTICS_METRICS,
  type YouTubeAnalyticsRepository,
} from "../index";

export const ANALYTICS_USER = "auth_test_youtube_analytics_user";
export const ANALYTICS_CHANNEL = "UC_youtube_analytics_repository";
export const ANALYTICS_IDENTITY = "youtube_identity_analytics_repository";

export function analyticsInput(batchId: string, collectedAt: string, views: string) {
  return {
    batch: {
      batchId,
      userId: ANALYTICS_USER,
      channelId: ANALYTICS_CHANNEL,
      requestedStartDate: "2026-09-01",
      requestedEndDate: "2026-09-12",
      effectiveDataThrough: "2026-09-10",
      collectedAt,
      outcome: "completed" as const,
      availableFields: [...YOUTUBE_ANALYTICS_METRICS],
      missingFields: [],
      channelRowCount: 1,
      videoRowCount: 1,
      videoCoverageCount: 1,
      videoCoverageLimit: 50,
    },
    channel: [{ batchId, metricDate: "2026-09-10", values: { views, estimatedMinutesWatched: "12.5", subscribersGained: "3", subscribersLost: "1" }, availableFields: ["views", "estimatedMinutesWatched", "subscribersGained", "subscribersLost"] as const }],
    videos: [{ batchId, videoId: "video_analytics_repository", metricDate: "2026-09-10", values: { views, averageViewDuration: "42.25", averageViewPercentage: "55.5" }, availableFields: ["views", "averageViewDuration", "averageViewPercentage"] as const }],
  };
}

export function runYouTubeAnalyticsRepositoryContract(
  name: string,
  factory: () => YouTubeAnalyticsRepository | Promise<YouTubeAnalyticsRepository>,
  cleanup?: (repository: YouTubeAnalyticsRepository) => Promise<void>,
): void {
  test(name + ": round-trips and updates capability state", async () => {
    const repository = await factory();
    try {
      const initial = { userId: ANALYTICS_USER, state: "authorized" as const, authorizedAt: "2026-09-12T10:00:00.000Z", updatedAt: "2026-09-12T10:00:00.000Z" };
      assert.equal((await repository.saveCapability(initial)).status, "success");
      const updated = { ...initial, lastCollectionAt: "2026-09-12T11:00:00.000Z", effectiveDataThrough: "2026-09-10", updatedAt: "2026-09-12T11:00:00.000Z" };
      assert.equal((await repository.saveCapability(updated)).status, "success");
      const result = await repository.getCapability(ANALYTICS_USER);
      assert.equal(result.status, "success");
      if (result.status === "success") assert.deepEqual(result.value, updated);
    } finally { await cleanup?.(repository); }
  });

  test(name + ": persists immutable daily observations and projects decimals", async () => {
    const repository = await factory();
    try {
      assert.equal((await repository.persist(analyticsInput("analytics_batch_one", "2026-09-12T11:00:00.000Z", "101.25"))).status, "success");
      const channel = await repository.getChannelProjection(ANALYTICS_USER, "30d", "2026-09-12T12:00:00.000Z");
      const videos = await repository.getVideoProjection(ANALYTICS_USER, "30d", "2026-09-12T12:00:00.000Z");
      assert.equal(channel.status, "success");
      assert.equal(videos.status, "success");
      if (channel.status === "success") {
        assert.equal(channel.value.values.views, "101.25");
        assert.equal(channel.value.values.netSubscribers, "2");
        assert.equal(channel.value.videoCount, 1);
      }
      if (videos.status === "success") assert.equal(videos.value[0]?.values.averageViewDuration, "42.25");
    } finally { await cleanup?.(repository); }
  });

  test(name + ": rejects duplicate immutable batches", async () => {
    const repository = await factory();
    try {
      const input = analyticsInput("analytics_batch_duplicate", "2026-09-12T11:00:00.000Z", "10");
      assert.equal((await repository.persist(input)).status, "success");
      const duplicate = await repository.persist(input);
      assert.equal(duplicate.status, "failure");
      if (duplicate.status === "failure") assert.equal(duplicate.error.code, "duplicate");
    } finally { await cleanup?.(repository); }
  });

  test(name + ": latest collection wins without crossing owner boundaries", async () => {
    const repository = await factory();
    try {
      await repository.persist(analyticsInput("analytics_batch_old", "2026-09-12T10:00:00.000Z", "10"));
      const latestBase = analyticsInput("analytics_batch_new", "2026-09-12T11:00:00.000Z", "20");
      const latest = {
        ...latestBase,
        batch: { ...latestBase.batch, effectiveDataThrough: "2026-09-11" },
      };
      await repository.persist({
        ...latest,
        channel: [{ ...latest.channel[0]!, values: { views: "20" }, availableFields: ["views"] }],
        videos: [{ ...latest.videos[0]!, values: { views: "20" }, availableFields: ["views"] }],
      });
      const owner = await repository.getChannelProjection(ANALYTICS_USER, "30d", "2026-09-12T12:00:00.000Z");
      const foreign = await repository.getChannelProjection("auth_test_foreign_analytics_user", "30d", "2026-09-12T12:00:00.000Z");
      const foreignVideos = await repository.getVideoProjection("auth_test_foreign_analytics_user", "30d", "2026-09-12T12:00:00.000Z");
      assert.equal(owner.status, "success");
      assert.equal(foreign.status, "success");
      if (owner.status === "success") assert.equal(owner.value.values.views, "20");
      if (owner.status === "success") assert.equal(owner.value.values.estimatedMinutesWatched, "12.5");
      if (owner.status === "success") assert.equal(owner.value.effectiveDataThrough, "2026-09-11");
      const videos = await repository.getVideoProjection(ANALYTICS_USER, "30d", "2026-09-12T12:00:00.000Z");
      if (videos.status === "success") assert.equal(videos.value[0]?.values.averageViewDuration, "42.25");
      if (foreign.status === "success") assert.equal(foreign.value.availability, "no-data");
      if (foreignVideos.status === "success") assert.deepEqual(foreignVideos.value, []);
    } finally { await cleanup?.(repository); }
  });
}

runYouTubeAnalyticsRepositoryContract(
  "YouTube Analytics repository/in-memory",
  () => new InMemoryYouTubeAnalyticsRepository(),
);
