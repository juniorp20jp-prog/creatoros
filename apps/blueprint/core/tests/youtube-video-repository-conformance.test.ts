import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InMemoryVideoSynchronizationRepository,
  type VideoSynchronization,
  type VideoSynchronizationRepository,
  type YouTubeVideo,
} from "../index";

export const VIDEO_TIME = "2026-09-02T12:00:00.000Z";
export const videoFixture: YouTubeVideo = {
  videoId: "video_repository_1",
  userId: "auth_test_video_user",
  channelId: "UC_repository",
  title: "Repository video",
  description: "Repository fixture",
  publishedAt: "2026-08-20T10:00:00.000Z",
  thumbnailUrl: "https://i.ytimg.com/vi/repository/hqdefault.jpg",
  durationSeconds: 120,
  viewCount: "18446744073709551615",
  likeCount: "20",
  commentCount: "2",
  privacyStatus: "public",
  tags: ["repository"],
  categoryId: "22",
  defaultLanguage: "en",
  sourceEtag: "etag-video-repository",
  availabilityStatus: "available",
  lastSeenAt: VIDEO_TIME,
  lastSyncedAt: VIDEO_TIME,
  createdAt: VIDEO_TIME,
  updatedAt: VIDEO_TIME,
};
export const videoSyncFixture: VideoSynchronization = {
  syncId: "youtube_video_sync_repository",
  userId: videoFixture.userId,
  youtubeIdentityId: "youtube_identity_channel_test",
  channelId: videoFixture.channelId,
  outcome: "completed",
  counts: {
    discovered: 1,
    created: 1,
    updated: 0,
    unchanged: 0,
    unavailable: 0,
  },
  coverageCount: 1,
  coverageLimit: 50,
  truncated: false,
  startedAt: VIDEO_TIME,
  completedAt: VIDEO_TIME,
};

export function runVideoSynchronizationRepositoryContract(
  name: string,
  factory: () =>
    | VideoSynchronizationRepository
    | Promise<VideoSynchronizationRepository>,
  cleanup?: (repository: VideoSynchronizationRepository) => Promise<void>,
): void {
  test(`${name}: atomically persists videos and synchronization audit`, async () => {
    const repository = await factory();
    try {
      const result = await repository.complete({
        created: [videoFixture],
        updated: [],
        synchronization: videoSyncFixture,
      });
      assert.equal(result.status, "success");
      const stored = await repository.getByIds(videoFixture.userId, [
        videoFixture.videoId,
      ]);
      if (stored.status === "success") {
        assert.equal(stored.value[0]?.viewCount, videoFixture.viewCount);
      }
      assert.equal(
        (await repository.getLatestByUserId(videoFixture.userId)).status,
        "success",
      );
    } finally {
      await cleanup?.(repository);
    }
  });

  test(`${name}: no-change adds history without duplicating or rewriting videos`, async () => {
    const repository = await factory();
    try {
      await repository.complete({
        created: [videoFixture],
        updated: [],
        synchronization: videoSyncFixture,
      });
      const noChange: VideoSynchronization = {
        ...videoSyncFixture,
        syncId: "youtube_video_sync_no_change",
        outcome: "no-change",
        counts: {
          discovered: 1,
          created: 0,
          updated: 0,
          unchanged: 1,
          unavailable: 0,
        },
        startedAt: "2026-09-02T12:05:00.000Z",
        completedAt: "2026-09-02T12:05:01.000Z",
      };
      await repository.complete({
        created: [],
        updated: [],
        synchronization: noChange,
      });
      const page = await repository.listByUserId(videoFixture.userId, {
        limit: 50,
      });
      if (page.status === "success") {
        assert.equal(page.value.videos.length, 1);
        assert.equal(page.value.videos[0]?.updatedAt, VIDEO_TIME);
      }
      const history = await repository.listSyncsByUserId(
        videoFixture.userId,
        10,
      );
      if (history.status === "success") assert.equal(history.value.length, 2);
    } finally {
      await cleanup?.(repository);
    }
  });

  test(`${name}: deterministic update and cursor pagination preserve ownership`, async () => {
    const repository = await factory();
    try {
      const second: YouTubeVideo = {
        ...videoFixture,
        videoId: "video_repository_2",
        title: "Older video",
        publishedAt: "2026-08-10T10:00:00.000Z",
      };
      await repository.complete({
        created: [videoFixture, second],
        updated: [],
        synchronization: {
          ...videoSyncFixture,
          counts: { ...videoSyncFixture.counts, discovered: 2, created: 2 },
          coverageCount: 2,
        },
      });
      const firstPage = await repository.listByUserId(videoFixture.userId, {
        limit: 1,
      });
      assert.equal(firstPage.status, "success");
      if (firstPage.status !== "success") return;
      assert.equal(firstPage.value.videos[0]?.videoId, videoFixture.videoId);
      assert.ok(firstPage.value.nextCursor);
      const secondPage = await repository.listByUserId(videoFixture.userId, {
        limit: 1,
        cursor: firstPage.value.nextCursor,
      });
      if (secondPage.status === "success") {
        assert.equal(secondPage.value.videos[0]?.videoId, second.videoId);
      }
    } finally {
      await cleanup?.(repository);
    }
  });

  test(`${name}: rejects cursors that do not belong to the requested user`, async () => {
    const repository = await factory();
    try {
      await repository.complete({
        created: [videoFixture],
        updated: [],
        synchronization: videoSyncFixture,
      });
      const result = await repository.listByUserId(videoFixture.userId, {
        limit: 1,
        cursor: {
          publishedAt: videoFixture.publishedAt,
          videoId: "video_owned_by_another_user",
        },
      });
      assert.equal(result.status, "failure");
      if (result.status === "failure") {
        assert.equal(result.error.code, "invalid-input");
      }
    } finally {
      await cleanup?.(repository);
    }
  });}

runVideoSynchronizationRepositoryContract(
  "Video synchronization repository/in-memory",
  () => new InMemoryVideoSynchronizationRepository(),
);
