import assert from "node:assert/strict";
import { test } from "node:test";

import {
  executeYouTubeIntelligence,
  InMemorySessionRepository,
  InMemoryUserRepository,
  RealYouTubeIntelligenceService,
  SessionService,
  VideoSynchronizationService,
  type Clock,
  type VideoSynchronization,
  type YouTubeVideo,
} from "../../../core";
import {
  AUTH_SESSION_COOKIE,
  CurrentSessionResolver,
  SessionTokenService,
} from "../../auth";
import { VideoSyncHttpHandlers } from "../video-sync-http";

const NOW = "2026-09-02T12:00:00.000Z";
const EXPIRY = "2026-09-03T12:00:00.000Z";
class TestClock implements Clock {
  now(): string { return NOW; }
}

const video: YouTubeVideo = {
  videoId: "video-http",
  userId: "auth_test_video_http",
  channelId: "UC_http",
  title: "HTTP video",
  description: "",
  publishedAt: "2026-08-20T10:00:00.000Z",
  durationSeconds: 100,
  viewCount: "500",
  privacyStatus: "public",
  availabilityStatus: "available",
  lastSeenAt: NOW,
  lastSyncedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};
const synchronization: VideoSynchronization = {
  syncId: "sync-http",
  userId: video.userId,
  youtubeIdentityId: "identity-http",
  channelId: video.channelId,
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
  startedAt: NOW,
  completedAt: NOW,
};

async function harness() {
  const clock = new TestClock();
  const users = new InMemoryUserRepository();
  await users.create({
    userId: video.userId,
    email: "video-http@example.com",
    displayName: "Video HTTP",
    locale: "es",
    createdAt: NOW,
  });
  const sessions = new InMemorySessionRepository(users);
  const sessionTokens = new SessionTokenService(
    "video-http-cookie-secret-at-least-32-characters",
  );
  const token = await sessionTokens.generate();
  await new SessionService(sessions, clock).createSession({
    sessionId: "session-video-http",
    userId: video.userId,
    tokenHash: token.tokenHash,
    expiresAt: EXPIRY,
    metadata: { clientType: "web" },
  });
  const execution = await executeYouTubeIntelligence({
    channel: { id: video.channelId, name: "HTTP Channel", subscribers: 100 },
    videos: [{
      id: video.videoId,
      title: video.title,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
      views: 500,
    }],
    context: {
      analysisDate: NOW,
      period: { startDate: video.publishedAt, endDate: video.publishedAt },
    },
  });
  assert.equal(execution.status, "completed");
  if (execution.status !== "completed") throw new Error("fixture failed");

  const synchronizationService = {
    synchronize: async () => ({
      status: "success" as const,
      value: { videos: [video], synchronization },
    }),
    list: async () => ({
      status: "success" as const,
      value: { videos: [video] },
    }),
    getStatus: async () => ({
      status: "success" as const,
      value: { videoCount: 1, lastSync: synchronization },
    }),
  } as unknown as VideoSynchronizationService;
  const intelligenceService = {
    analyze: async () => ({
      status: "success" as const,
      value: {
        output: execution.output,
        excludedVideoCount: 0,
        synchronization,
      },
    }),
  } as unknown as RealYouTubeIntelligenceService;
  const handlers = new VideoSyncHttpHandlers(
    new CurrentSessionResolver(sessions, users, sessionTokens, clock),
    async () => ({
      synchronization: synchronizationService,
      intelligence: intelligenceService,
    }),
  );
  return {
    handlers,
    cookie: `${AUTH_SESSION_COOKIE}=${token.token}`,
  };
}

test("all video and intelligence endpoints require CreatorOS authentication", async () => {
  const { handlers } = await harness();
  for (const response of [
    await handlers.synchronize(new Request("http://localhost/api/youtube/videos/sync", { method: "POST" })),
    await handlers.list(new Request("http://localhost/api/youtube/videos")),
    await handlers.status(new Request("http://localhost/api/youtube/videos/status")),
    await handlers.intelligence(new Request("http://localhost/api/youtube/intelligence", { method: "POST" })),
  ]) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("authenticated endpoints expose safe read models and no-store", async () => {
  const { handlers, cookie } = await harness();
  const request = (url: string, method = "GET") =>
    new Request(url, { method, headers: { cookie } });
  const responses = [
    await handlers.synchronize(request("http://localhost/api/youtube/videos/sync", "POST")),
    await handlers.list(request("http://localhost/api/youtube/videos")),
    await handlers.status(request("http://localhost/api/youtube/videos/status")),
    await handlers.intelligence(request("http://localhost/api/youtube/intelligence", "POST")),
  ];
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.text();
    for (const forbidden of [
      "userId",
      "youtubeIdentityId",
      "syncId",
      "accessToken",
      "refreshToken",
      "authorization",
      "rawPayload",
    ]) assert.equal(body.includes(forbidden), false);
  }
});

test("invalid opaque cursor is rejected without repository access", async () => {
  const { handlers, cookie } = await harness();
  const response = await handlers.list(
    new Request("http://localhost/api/youtube/videos?cursor=not-a-cursor", {
      headers: { cookie },
    }),
  );
  assert.equal(response.status, 400);
});
