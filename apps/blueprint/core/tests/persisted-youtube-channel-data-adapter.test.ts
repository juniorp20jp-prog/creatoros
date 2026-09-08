import assert from "node:assert/strict";
import test from "node:test";

import {
  PersistedYouTubeChannelDataAdapter,
  type Clock,
  type PersistedYouTubeChannelData,
  type YouTubeChannel,
  type YouTubeVideo,
} from "../index";

const now = "2026-09-07T12:00:00.000Z";
const clock: Clock = { now: () => now };

function channel(overrides: Partial<YouTubeChannel> = {}): YouTubeChannel {
  return {
    userId: "user_a",
    youtubeIdentityId: "youtube_identity_a",
    channelId: "channel_a",
    title: "Real channel",
    description: "",
    publishedAt: "2020-01-01T00:00:00.000Z",
    subscriberCount: "1000",
    viewCount: "25000",
    videoCount: "2",
    hiddenSubscriberCount: false,
    keywords: [],
    brandingSettings: { keywords: [] },
    privacyStatus: "public",
    lastSyncedAt: now,
    syncStatus: "synced",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function video(
  videoId: string,
  publishedAt: string,
  overrides: Partial<YouTubeVideo> = {},
): YouTubeVideo {
  return {
    userId: "user_a",
    channelId: "channel_a",
    videoId,
    title: videoId,
    description: "",
    publishedAt,
    durationSeconds: 60,
    viewCount: "100",
    availabilityStatus: "available",
    lastSeenAt: now,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function source(overrides: Partial<PersistedYouTubeChannelData> = {}): PersistedYouTubeChannelData {
  return {
    creator: { userId: "user_a", displayName: "Creator A", locale: "es" },
    channel: channel(),
    videos: [
      video("video_b", "2026-02-01T00:00:00.000Z"),
      video("video_a", "2026-01-01T00:00:00.000Z"),
    ],
    collectedAt: now,
    synchronizationReference: "video-sync:sync_a",
    ...overrides,
  };
}

test("persisted YouTube adapter maps provider-neutral channel and videos deterministically", () => {
  const result = new PersistedYouTubeChannelDataAdapter(clock).adapt(source());
  if (result.status === "failure") assert.fail("adapter unexpectedly failed");
  assert.equal(result.status, "partial");
  assert.equal(result.rawChannelData.creator.id, "user_a");
  assert.equal(result.rawChannelData.channel.id, "channel_a");
  assert.deepEqual(result.rawChannelData.videos.map((item) => item.id), ["video_a", "video_b"]);
  assert.equal("youtubeIdentityId" in result.rawChannelData.channel, false);
});

test("persisted YouTube adapter omits unsafe optional counters without truncating", () => {
  const unsafe = String(BigInt(Number.MAX_SAFE_INTEGER) + 1n);
  const result = new PersistedYouTubeChannelDataAdapter(clock).adapt(source({
    channel: channel({ viewCount: unsafe }),
    videos: [video("video_a", "2026-01-01T00:00:00.000Z", { likeCount: unsafe })],
  }));
  assert.notEqual(result.status, "failure");
  if (result.status === "failure") return;
  assert.equal(result.rawChannelData.channel.totalViews, undefined);
  assert.equal(result.rawChannelData.videos[0]?.likes, undefined);
  assert.equal(result.warnings.some((warning) => warning.code === "UNSAFE_INTEGER_OMITTED"), true);
});

test("persisted YouTube adapter excludes a video whose required view count is unavailable", () => {
  const result = new PersistedYouTubeChannelDataAdapter(clock).adapt(source({
    videos: [video("video_a", "2026-01-01T00:00:00.000Z", { viewCount: undefined })],
  }));
  assert.notEqual(result.status, "failure");
  if (result.status === "failure") return;
  assert.deepEqual(result.rawChannelData.videos, []);
  assert.equal(result.status, "partial");
});

test("persisted YouTube adapter rejects a cross-tenant channel", () => {
  const result = new PersistedYouTubeChannelDataAdapter(clock).adapt(source({
    channel: channel({ userId: "user_b" }),
  }));
  assert.equal(result.status, "failure");
  assert.equal(result.errors[0]?.code, "IDENTITY_MISMATCH");
});

test("persisted YouTube adapter rejects an unsafe required subscriber counter", () => {
  const result = new PersistedYouTubeChannelDataAdapter(clock).adapt(source({
    channel: channel({ subscriberCount: "9007199254740992" }),
  }));
  assert.equal(result.status, "failure");
  assert.equal(result.errors.some((error) => error.path === "$.channel.subscriberCount"), true);
});