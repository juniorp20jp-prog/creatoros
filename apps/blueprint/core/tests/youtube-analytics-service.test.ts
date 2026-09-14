import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryYouTubeAnalyticsRepository,
  YOUTUBE_ANALYTICS_READONLY_SCOPE,
  YOUTUBE_READONLY_SCOPE,
  YouTubeAnalyticsCollectionService,
  type ChannelRepository,
  type Clock,
  type IdGenerator,
  type VideoRepository,
  type YouTubeAnalyticsAdapter,
  type YouTubeAnalyticsProviderResult,
  type YouTubeAnalyticsRepository,
  type YouTubeAuthorizationService,
} from "../index";

const NOW = "2026-09-12T12:00:00.000Z";

function createHarness(adapter: YouTubeAnalyticsAdapter) {
  const persisted: Array<Parameters<YouTubeAnalyticsRepository["persist"]>[0]> = [];
  const memory = new InMemoryYouTubeAnalyticsRepository();
  const repository: YouTubeAnalyticsRepository = {
    getCapability: (userId) => memory.getCapability(userId),
    saveCapability: (value) => memory.saveCapability(value),
    getChannelProjection: (userId, period, asOf) => memory.getChannelProjection(userId, period, asOf),
    getVideoProjection: (userId, period, asOf) => memory.getVideoProjection(userId, period, asOf),
    persist: async (input) => {
      persisted.push(structuredClone(input));
      return memory.persist(input);
    },
  };
  const authorization = {
    getStatus: async () => ({ status: "success" as const, value: { connected: true, channelId: "channel", channelTitle: "Channel", scopes: [YOUTUBE_READONLY_SCOPE, YOUTUBE_ANALYTICS_READONLY_SCOPE], connectedAt: NOW, updatedAt: NOW } }),
    getAccessToken: async () => ({ status: "success" as const, value: "access-secret" }),
  } as unknown as YouTubeAuthorizationService;
  const channels = {
    getByUserId: async () => ({ status: "success" as const, value: { channelId: "channel" } }),
  } as unknown as ChannelRepository;
  const videos = {
    listByUserId: async () => ({ status: "success" as const, value: { videos: Array.from({ length: 60 }, (_, index) => ({ videoId: "video-" + index })) } }),
  } as unknown as VideoRepository;
  const clock: Clock = { now: () => NOW };
  let sequence = 0;
  const ids: IdGenerator = { create: (prefix) => prefix + "-" + ++sequence };
  return {
    service: new YouTubeAnalyticsCollectionService(authorization, channels, videos, repository, adapter, clock, ids),
    repository,
    persisted,
  };
}

test("collection bounds managed videos to 50 and persists provider-only observations", async () => {
  let requestedVideos = 0;
  const adapter: YouTubeAnalyticsAdapter = {
    collect: async (input) => {
      requestedVideos = input.videoIds.length;
      return { status: "success", value: { channel: [], videos: [], availableFields: [], missingFields: [], partial: false } };
    },
  };
  const { service, persisted } = createHarness(adapter);
  const result = await service.collect("user", "90d");
  assert.equal(result.status, "success");
  assert.equal(requestedVideos, 50);
  assert.equal(persisted[0]?.batch.outcome, "no-data");
  assert.deepEqual(persisted[0]?.channel, []);
  assert.deepEqual(persisted[0]?.videos, []);
});

test("provider failure creates an auditable failed batch without fabricated metrics", async () => {
  const adapter: YouTubeAnalyticsAdapter = {
    collect: async () => ({ status: "failure", error: { code: "quota", message: "safe provider failure" } }),
  };
  const { service, repository, persisted } = createHarness(adapter);
  const result = await service.collect("user", "30d");
  assert.equal(result.status, "failure");
  if (result.status === "failure") assert.equal(result.error.code, "provider-failure");
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.batch.outcome, "failed");
  assert.equal(persisted[0]?.batch.channelRowCount, 0);
  assert.equal(persisted[0]?.batch.videoRowCount, 0);
  assert.deepEqual(persisted[0]?.channel, []);
  assert.deepEqual(persisted[0]?.videos, []);
  const capability = await repository.getCapability("user");
  assert.equal(capability.status, "success");
  if (capability.status === "success") assert.equal(capability.value.state, "temporarily-unavailable");
});

test("one runtime service prevents overlapping collections for the same user", async () => {
  let release: ((result: YouTubeAnalyticsProviderResult) => void) | undefined;
  const pending = new Promise<YouTubeAnalyticsProviderResult>((resolve) => { release = resolve; });
  const { service } = createHarness({ collect: async () => pending });
  const first = service.collect("user", "7d");
  await new Promise<void>((resolve) => setImmediate(resolve));
  const overlapping = await service.collect("user", "7d");
  assert.equal(overlapping.status, "failure");
  if (overlapping.status === "failure") assert.equal(overlapping.error.code, "collection-in-progress");
  release?.({ status: "success", value: { channel: [], videos: [], availableFields: [], missingFields: [], partial: false } });
  assert.equal((await first).status, "success");
});
