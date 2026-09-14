import assert from "node:assert/strict";
import { test } from "node:test";

import {
  executeYouTubeIntelligence,
  InMemoryVideoSynchronizationRepository,
  InMemoryYouTubeAuthorizationRepository,
  mapPersistedYouTubeDataToIntelligenceInput,
  parseYouTubeDurationSeconds,
  VideoSynchronizationService,
  YouTubeAuthorizationService,
  YOUTUBE_READONLY_SCOPE,
  type Clock,
  type IdGenerator,
  type RefreshedYouTubeGrant,
  type TokenProtectionResult,
  type YouTubeAuthorizationProvider,
  type YouTubeProviderResult,
  type YouTubeTokenProtector,
  type YouTubeVideoApiAdapter,
  type YouTubeVideoApiResult,
  type YouTubeVideoSnapshot,
} from "../index";

const NOW = "2026-09-02T12:00:00.000Z";
const LATER = "2026-09-02T12:01:00.000Z";
const FUTURE = "2026-09-03T12:00:00.000Z";
const snapshot: YouTubeVideoSnapshot = {
  videoId: "video-1",
  channelId: "UC_video_sync",
  title: "Real upload",
  description: "Public description",
  publishedAt: "2026-08-20T10:00:00.000Z",
  thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
  durationSeconds: 123,
  viewCount: "9007199254740993",
  likeCount: "25",
  commentCount: "4",
  privacyStatus: "public",
  tags: ["creator", "travel"],
  categoryId: "22",
  defaultLanguage: "es",
  sourceEtag: "video-etag-1",
  availabilityStatus: "available",
};

class MutableClock implements Clock {
  constructor(public value = NOW) {}
  now(): string { return this.value; }
}
class TestIds implements IdGenerator {
  private value = 0;
  create(prefix: string): string { return `${prefix}_${++this.value}`; }
}
class Protector implements YouTubeTokenProtector {
  readonly activeKeyId = "test";
  async protect(value: string): Promise<TokenProtectionResult<string>> {
    return { status: "success", value: `encrypted:${value}` };
  }
  async reveal(value: string): Promise<TokenProtectionResult<string>> {
    return { status: "success", value: value.replace(/^encrypted:/u, "") };
  }
}
class Provider implements YouTubeAuthorizationProvider {
  refreshes = 0;
  async refresh(): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>> {
    this.refreshes += 1;
    return {
      status: "success",
      value: { accessToken: "refreshed", accessTokenExpiresAt: FUTURE },
    };
  }
  async revoke(): Promise<YouTubeProviderResult<true>> {
    return { status: "success", value: true };
  }
}
class Api implements YouTubeVideoApiAdapter {
  calls = 0;
  constructor(private readonly results: YouTubeVideoApiResult[]) {}
  async fetchUploadVideoWindow(): Promise<YouTubeVideoApiResult> {
    this.calls += 1;
    return this.results.shift() ?? {
      status: "failure",
      error: { code: "api-failure", message: "No fixture." },
    };
  }
}

function window(videos: ReadonlyArray<YouTubeVideoSnapshot>, unavailable = 0): YouTubeVideoApiResult {
  return {
    status: "success",
    value: {
      channelId: "UC_video_sync",
      videos,
      discovered: videos.length + unavailable,
      unavailable,
      coverageCount: videos.length + unavailable,
      coverageLimit: 50,
      truncated: false,
    },
  };
}

async function harness(results: YouTubeVideoApiResult[]) {
  const clock = new MutableClock();
  const ids = new TestIds();
  const protector = new Protector();
  const provider = new Provider();
  const authorizations = new InMemoryYouTubeAuthorizationRepository();
  const authorizationService = new YouTubeAuthorizationService(
    authorizations,
    protector,
    provider,
    clock,
    ids,
  );
  await authorizationService.connect("user-video", {
    providerUserId: "provider-video",
    channelId: "UC_video_sync",
    channelTitle: "Real Channel",
    scopes: [YOUTUBE_READONLY_SCOPE],
    refreshToken: "refresh",
    accessToken: "access",
    accessTokenExpiresAt: FUTURE,
  });
  const repository = new InMemoryVideoSynchronizationRepository();
  const api = new Api(results);
  const service = new VideoSynchronizationService(
    repository,
    authorizations,
    authorizationService,
    api,
    clock,
    ids,
  );
  return { api, clock, provider, repository, service };
}

test("ISO 8601 YouTube durations convert deterministically to seconds", () => {
  assert.equal(parseYouTubeDurationSeconds("PT2M3S"), 123);
  assert.equal(parseYouTubeDurationSeconds("P1DT2H3M4S"), 93_784);
  assert.equal(parseYouTubeDurationSeconds("PT0S"), 0);
  assert.equal(parseYouTubeDurationSeconds("invalid"), undefined);
  assert.equal(parseYouTubeDurationSeconds("PT0.5S"), undefined);
});

test("initial real video synchronization persists normalized data and audit", async () => {
  const { repository, service } = await harness([window([snapshot])]);
  const result = await service.synchronize("user-video");
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.value.synchronization.outcome, "completed");
    assert.equal(result.value.synchronization.counts.created, 1);
    assert.equal(result.value.videos[0]?.viewCount, "9007199254740993");
  }
  const history = await repository.listSyncsByUserId("user-video", 10);
  assert.equal(history.status, "success");
});

test("immediate second synchronization is no-change with no duplicate", async () => {
  const { clock, repository, service } = await harness([
    window([snapshot]),
    window([snapshot]),
  ]);
  await service.synchronize("user-video");
  clock.value = LATER;
  const second = await service.synchronize("user-video");
  assert.equal(second.status, "success");
  if (second.status === "success") {
    assert.equal(second.value.synchronization.outcome, "no-change");
    assert.deepEqual(second.value.synchronization.counts, {
      discovered: 1,
      created: 0,
      updated: 0,
      unchanged: 1,
      unavailable: 0,
    });
  }
  const page = await repository.listByUserId("user-video", { limit: 50 });
  if (page.status === "success") assert.equal(page.value.videos.length, 1);
  const history = await repository.listSyncsByUserId("user-video", 10);
  if (history.status === "success") assert.equal(history.value.length, 2);
});

test("a semantic change updates only the matching provider identity", async () => {
  const changed = { ...snapshot, title: "Updated real upload", sourceEtag: "video-etag-2" };
  const { clock, service } = await harness([window([snapshot]), window([changed])]);
  await service.synchronize("user-video");
  clock.value = LATER;
  const result = await service.synchronize("user-video");
  if (result.status === "success") {
    assert.equal(result.value.synchronization.counts.updated, 1);
    assert.equal(result.value.videos[0]?.title, changed.title);
  }
});

test("unavailable playlist entries produce partial audit without false deletion", async () => {
  const { clock, repository, service } = await harness([
    window([snapshot]),
    window([], 1),
  ]);
  await service.synchronize("user-video");
  clock.value = LATER;
  const result = await service.synchronize("user-video");
  if (result.status === "success") {
    assert.equal(result.value.synchronization.outcome, "partial");
    assert.equal(result.value.synchronization.counts.unavailable, 1);
  }
  const stored = await repository.listByUserId("user-video", { limit: 50 });
  if (stored.status === "success") assert.equal(stored.value.videos.length, 1);
});

test("duplicate video IDs and wrong channel data fail before persistence", async () => {
  for (const videos of [
    [snapshot, snapshot],
    [{ ...snapshot, channelId: "UC_other" }],
  ]) {
    const { service } = await harness([window(videos)]);
    const result = await service.synchronize("user-video");
    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "invalid-provider-data");
    }
  }
});

test("one unauthorized provider response refreshes and retries once", async () => {
  const { api, provider, service } = await harness([
    {
      status: "failure",
      error: { code: "unauthorized", message: "Expired." },
    },
    window([snapshot]),
  ]);
  assert.equal((await service.synchronize("user-video")).status, "success");
  assert.equal(provider.refreshes, 1);
  assert.equal(api.calls, 2);
});

test("real intelligence mapper excludes unsafe counters without truncation", async () => {
  const { service } = await harness([
    window([
      snapshot,
      {
        ...snapshot,
        videoId: "video-2",
        title: "Safe upload",
        viewCount: "100",
      },
    ]),
  ]);
  const result = await service.synchronize("user-video");
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  const channel = {
    channelId: "UC_video_sync",
    userId: "user-video",
    youtubeIdentityId: "identity-video",
    title: "Real Channel",
    description: "",
    publishedAt: "2020-01-01T00:00:00.000Z",
    subscriberCount: "1200",
    viewCount: "9000",
    videoCount: "2",
    hiddenSubscriberCount: false,
    keywords: [],
    brandingSettings: { keywords: [] },
    privacyStatus: "public" as const,
    lastSyncedAt: NOW,
    syncStatus: "synced" as const,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const mapped = mapPersistedYouTubeDataToIntelligenceInput(
    channel,
    result.value.videos,
    NOW,
    [{ videoId: "video-2", values: { averageViewDuration: "45.5", averageViewPercentage: "62.5", subscribersGained: "3", subscribersLost: "1", estimatedMinutesWatched: "90" }, availableFields: ["averageViewDuration", "averageViewPercentage", "subscribersGained", "subscribersLost", "estimatedMinutesWatched"], observedDays: 7 }],
  );
  assert.equal(mapped.status, "success");
  if (mapped.status === "success") {
    assert.equal(mapped.value.excludedVideoCount, 1);
    assert.equal(mapped.value.input.videos.length, 1);
    assert.equal(mapped.value.input.videos[0]?.averageViewDurationSeconds, 45.5);
    assert.equal(mapped.value.input.videos[0]?.averagePercentageViewed, 62.5);
    assert.equal(mapped.value.input.videos[0]?.subscribersGained, 3);
    const execution = await executeYouTubeIntelligence(mapped.value.input);
    assert.equal(execution.status, "completed");
    if (execution.status === "completed") {
      assert.equal(execution.output.summary.analyzedVideoCount, 1);
      assert.equal(execution.output.videos[0]?.metrics.impressions, undefined);
      assert.equal(execution.output.videos[0]?.metrics.ctr, undefined);
      assert.equal(execution.output.videos[0]?.metrics.averagePercentageViewed, 62.5);
    }
  }
});
