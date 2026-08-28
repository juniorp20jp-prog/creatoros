import assert from "node:assert/strict";
import { test } from "node:test";

import { ChannelSynchronizationService, InMemoryChannelSynchronizationRepository, InMemoryYouTubeAuthorizationRepository, YouTubeAuthorizationService, YOUTUBE_READONLY_SCOPE, type Clock, type IdGenerator, type RefreshedYouTubeGrant, type TokenProtectionResult, type YouTubeApiAdapter, type YouTubeAuthorizationProvider, type YouTubeChannelApiResult, type YouTubeProviderResult, type YouTubeTokenProtector } from "../index";

const NOW = "2026-08-03T12:00:00.000Z";
const LATER = "2026-08-03T12:01:00.000Z";
const FUTURE = "2026-08-03T13:00:00.000Z";
const PAST = "2026-08-03T11:00:00.000Z";
const snapshot = { channelId: "UC_sync", title: "Creator Channel", handle: "@creator", description: "Channel description", publishedAt: "2020-01-01T00:00:00.000Z", country: "US", customUrl: "@creator", thumbnailUrl: "https://yt.example/thumbnail.jpg", bannerUrl: "https://yt.example/banner.jpg", subscriberCount: "1200", viewCount: "45000", videoCount: "80", hiddenSubscriberCount: false, defaultLanguage: "en", keywords: ["creator", "education"], brandingSettings: { title: "Creator Channel", description: "Channel description", defaultLanguage: "en", country: "US", keywords: ["creator", "education"], bannerUrl: "https://yt.example/banner.jpg" }, privacyStatus: "public" as const, sourceEtag: "etag-1" };

class MutableClock implements Clock { constructor(public value = NOW) {} now(): string { return this.value; } }
class TestIds implements IdGenerator { private value = 0; create(prefix: string): string { return `${prefix}_${++this.value}`; } }
class TestProtector implements YouTubeTokenProtector { readonly activeKeyId = "test"; async protect(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: `encrypted:${value}` }; } async reveal(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: value.replace(/^encrypted:/u, "") }; } }
class TestProvider implements YouTubeAuthorizationProvider { refreshCount = 0; revokeCount = 0; async refresh(): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>> { this.refreshCount += 1; return { status: "success", value: { accessToken: "refreshed-access", refreshToken: "rotated-refresh", accessTokenExpiresAt: FUTURE } }; } async revoke(): Promise<YouTubeProviderResult<true>> { this.revokeCount += 1; return { status: "success", value: true }; } }
class TestApi implements YouTubeApiAdapter { inputs: Array<{ token: string; etag?: string }> = []; constructor(private readonly results: YouTubeChannelApiResult[]) {} async fetchAuthenticatedChannel(token: string, etag?: string): Promise<YouTubeChannelApiResult> { this.inputs.push({ token, ...(etag ? { etag } : {}) }); return this.results.shift() ?? { status: "failure", error: { code: "api-failure", message: "No fixture." } }; } }

async function harness(results: YouTubeChannelApiResult[], accessExpiry = FUTURE) {
  const clock = new MutableClock();
  const ids = new TestIds();
  const protector = new TestProtector();
  const provider = new TestProvider();
  const authorizations = new InMemoryYouTubeAuthorizationRepository();
  const authorizationService = new YouTubeAuthorizationService(authorizations, protector, provider, clock, ids);
  await authorizationService.connect("user_sync", { providerUserId: "provider", channelId: snapshot.channelId, channelTitle: snapshot.title, scopes: [YOUTUBE_READONLY_SCOPE], refreshToken: "refresh-token", accessToken: "access-token", accessTokenExpiresAt: accessExpiry });
  const channels = new InMemoryChannelSynchronizationRepository();
  const api = new TestApi(results);
  const service = new ChannelSynchronizationService(channels, authorizations, authorizationService, protector, api, clock, ids);
  return { api, channels, clock, provider, service };
}

test("initial synchronization persists the authenticated channel and audit", async () => {
  const { channels, service } = await harness([{ status: "success", value: snapshot }]);
  const result = await service.synchronize("user_sync");
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.value.channel.channelId, snapshot.channelId);
    assert.equal(result.value.synchronization.outcome, "completed");
    assert.ok(result.value.synchronization.changedFields.includes("title"));
  }
  assert.equal((await channels.listByUserId("user_sync", 10)).status, "success");
});

test("identical re-synchronization is idempotent and creates no duplicate channel", async () => {
  const { channels, clock, service } = await harness([{ status: "success", value: snapshot }, { status: "success", value: snapshot }]);
  await service.synchronize("user_sync");
  clock.value = LATER;
  const second = await service.synchronize("user_sync");
  assert.equal(second.status, "success");
  if (second.status === "success") assert.equal(second.value.synchronization.outcome, "no-change");
  const history = await channels.listByUserId("user_sync", 10);
  if (history.status === "success") assert.equal(history.value.length, 2);
  assert.equal((await channels.getByChannelId(snapshot.channelId)).status, "success");
});

test("re-synchronization reports and persists only changed fields", async () => {
  const changed = { ...snapshot, title: "Updated Channel", brandingSettings: { ...snapshot.brandingSettings, title: "Updated Channel" }, sourceEtag: "etag-2" };
  const { channels, clock, service } = await harness([{ status: "success", value: snapshot }, { status: "success", value: changed }]);
  await service.synchronize("user_sync");
  clock.value = LATER;
  const result = await service.synchronize("user_sync");
  if (result.status === "success") assert.deepEqual(result.value.synchronization.changedFields, ["title", "brandingSettings", "sourceEtag"]);
  const stored = await channels.getByUserId("user_sync");
  if (stored.status === "success") assert.equal(stored.value.title, "Updated Channel");
});

for (const fixture of [
  { name: "missing channel", api: { status: "failure", error: { code: "channel-not-found", message: "Missing." } } as const, expected: "channel-not-found" },
  { name: "quota exceeded", api: { status: "failure", error: { code: "quota-exceeded", message: "Quota." } } as const, expected: "quota-exceeded" },
  { name: "provider failure", api: { status: "failure", error: { code: "api-failure", message: "Provider." } } as const, expected: "api-failure" },
]) test(`${fixture.name} records a safe failed synchronization`, async () => { const { channels, service } = await harness([fixture.api]); const result = await service.synchronize("user_sync"); assert.equal(result.status, "failure"); if (result.status === "failure") assert.equal(result.error.code, fixture.expected); const latest = await channels.getLatestByUserId("user_sync"); if (latest.status === "success") assert.equal(latest.value.failureCode, fixture.expected); });

test("private channels are not persisted and are recorded as controlled failures", async () => {
  const { channels, service } = await harness([{ status: "success", value: { ...snapshot, privacyStatus: "private" } }]);
  const result = await service.synchronize("user_sync");
  assert.equal(result.status, "failure");
  if (result.status === "failure") assert.equal(result.error.code, "channel-private");
  assert.equal((await channels.getByUserId("user_sync")).status, "failure");
});

test("failed audit without a persisted channel does not report a connected channel", async () => {
  const { service } = await harness([{ status: "failure", error: { code: "channel-not-found", message: "Missing." } }]);
  await service.synchronize("user_sync");
  const status = await service.getStatus("user_sync");
  assert.equal(status.status, "success");
  if (status.status === "success") {
    assert.equal(status.value.channelConnected, false);
    assert.equal(status.value.lastSync?.outcome, "failed");
  }
});

test("expired access token is refreshed automatically before the API request", async () => {
  const { api, provider, service } = await harness([{ status: "success", value: snapshot }], PAST);
  assert.equal((await service.synchronize("user_sync")).status, "success");
  assert.equal(provider.refreshCount, 1);
  assert.equal(api.inputs[0]?.token, "refreshed-access");
});

test("one unauthorized API response triggers one refresh and one retry", async () => {
  const { api, provider, service } = await harness([{ status: "failure", error: { code: "unauthorized", message: "Expired." } }, { status: "success", value: snapshot }]);
  assert.equal((await service.synchronize("user_sync")).status, "success");
  assert.equal(provider.refreshCount, 1);
  assert.deepEqual(api.inputs.map((input) => input.token), ["access-token", "refreshed-access"]);
});

test("ETag not-modified records an audit without replacing channel metadata", async () => {
  const { api, clock, service } = await harness([{ status: "success", value: snapshot }, { status: "not-modified" }]);
  await service.synchronize("user_sync");
  clock.value = LATER;
  const result = await service.synchronize("user_sync");
  if (result.status === "success") assert.equal(result.value.synchronization.outcome, "no-change");
  assert.equal(api.inputs[1]?.etag, "etag-1");
});
