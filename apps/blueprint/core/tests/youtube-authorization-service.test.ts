import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryYouTubeAuthorizationRepository, YouTubeAuthorizationService, YOUTUBE_ANALYTICS_READONLY_SCOPE, YOUTUBE_READONLY_SCOPE, type Clock, type IdGenerator, type RefreshedYouTubeGrant, type TokenProtectionResult, type YouTubeAuthorizationProvider, type YouTubeProviderResult, type YouTubeTokenProtector } from "../index";

const NOW = "2026-08-02T12:00:00.000Z";
const LATER = "2026-08-02T12:30:00.000Z";
const EXPIRY = "2026-08-02T13:00:00.000Z";
const grant = { providerUserId: "google-subject", channelId: "UC_creator", channelTitle: "Creator Channel", scopes: [YOUTUBE_READONLY_SCOPE], refreshToken: "refresh-secret", accessToken: "access-secret", accessTokenExpiresAt: EXPIRY } as const;

class TestClock implements Clock { private index = 0; constructor(private readonly values: ReadonlyArray<string> = [NOW]) {} now(): string { return this.values[Math.min(this.index++, this.values.length - 1)] ?? NOW; } }
class TestIds implements IdGenerator { private index = 0; create(prefix: string): string { this.index += 1; return `${prefix}_${this.index}`; } }
class TestProtector implements YouTubeTokenProtector {
  readonly activeKeyId = "test-key";
  async protect(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: `encrypted:${value}` }; }
  async reveal(value: string): Promise<TokenProtectionResult<string>> { return value.startsWith("encrypted:") ? { status: "success", value: value.slice(10) } : { status: "failure", error: { code: "token-protection-failed", message: "Token failed." } }; }
}
class TestProvider implements YouTubeAuthorizationProvider {
  refreshInputs: string[] = [];
  revokeInputs: string[] = [];
  constructor(private readonly refreshed: RefreshedYouTubeGrant = { accessToken: "new-access", refreshToken: "new-refresh", accessTokenExpiresAt: EXPIRY }) {}
  async refresh(value: string): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>> { this.refreshInputs.push(value); return { status: "success", value: this.refreshed }; }
  async revoke(value: string): Promise<YouTubeProviderResult<true>> { this.revokeInputs.push(value); return { status: "success", value: true }; }
}

function harness(clock: Clock = new TestClock([NOW, LATER])) {
  const repository = new InMemoryYouTubeAuthorizationRepository();
  const provider = new TestProvider();
  const service = new YouTubeAuthorizationService(repository, new TestProtector(), provider, clock, new TestIds());
  return { repository, provider, service };
}

test("connect persists only encrypted tokens and returns a safe connection status", async () => {
  const { repository, service } = harness();
  const result = await service.connect("user_1", grant);
  assert.equal(result.status, "success");
  const identity = await repository.getByUserId("user_1");
  assert.equal(identity.status, "success");
  if (identity.status !== "success") return;
  const token = await repository.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
  assert.equal(token.status, "success");
  if (token.status === "success") {
    assert.equal(token.value.encryptedRefreshToken, "encrypted:refresh-secret");
    assert.equal(token.value.encryptedAccessToken, "encrypted:access-secret");
    assert.equal(JSON.stringify(token.value).includes('"refresh-secret"'), false);
  }
  if (result.status === "success") assert.equal("refreshToken" in result.value, false);
});

test("reconnect reuses the stored refresh token when Google does not return another", async () => {
  const { repository, service } = harness();
  await service.connect("user_1", grant);
  const reconnected = await service.connect("user_1", { ...grant, refreshToken: undefined, accessToken: "second-access" });
  assert.equal(reconnected.status, "success");
  const identity = await repository.getByUserId("user_1");
  if (identity.status !== "success") return;
  const token = await repository.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
  if (token.status === "success") assert.equal(token.value.encryptedRefreshToken, "encrypted:refresh-secret");
});

test("incremental authorization unions scopes and preserves the encrypted refresh token", async () => {
  const { repository, service } = harness();
  await service.connect("user_1", grant);
  const upgraded = await service.connect("user_1", { ...grant, scopes: [YOUTUBE_ANALYTICS_READONLY_SCOPE], refreshToken: undefined, accessToken: "analytics-access" });
  assert.equal(upgraded.status, "success");
  if (upgraded.status === "success") assert.deepEqual(upgraded.value.scopes, [YOUTUBE_READONLY_SCOPE, YOUTUBE_ANALYTICS_READONLY_SCOPE]);
  const identity = await repository.getByUserId("user_1");
  assert.equal(identity.status, "success");
  if (identity.status !== "success") return;
  const token = await repository.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
  assert.equal(token.status, "success");
  if (token.status === "success") assert.equal(token.value.encryptedRefreshToken, "encrypted:refresh-secret");
});

test("incremental authorization rejects a different provider identity without changing the connection", async () => {
  const { repository, service } = harness();
  await service.connect("user_1", grant);
  const upgraded = await service.connect("user_1", { ...grant, providerUserId: "other-subject", scopes: [YOUTUBE_ANALYTICS_READONLY_SCOPE], refreshToken: undefined });
  assert.equal(upgraded.status, "failure");
  const identity = await repository.getByUserId("user_1");
  assert.equal(identity.status, "success");
  if (identity.status === "success") assert.deepEqual(identity.value.scopes, [YOUTUBE_READONLY_SCOPE]);
});

test("refresh reveals only the refresh credential and persists rotated provider tokens", async () => {
  const { repository, provider, service } = harness();
  await service.connect("user_1", grant);
  const refreshed = await service.refresh("user_1");
  assert.equal(refreshed.status, "success");
  assert.deepEqual(provider.refreshInputs, ["refresh-secret"]);
  const identity = await repository.getByUserId("user_1");
  if (identity.status !== "success") return;
  const token = await repository.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
  if (token.status === "success") assert.equal(token.value.encryptedRefreshToken, "encrypted:new-refresh");
});

test("disconnect revokes remotely, marks the identity revoked and deletes local credentials", async () => {
  const { repository, provider, service } = harness();
  await service.connect("user_1", grant);
  const disconnected = await service.disconnect("user_1");
  assert.equal(disconnected.status, "success");
  assert.deepEqual(provider.revokeInputs, ["refresh-secret"]);
  const identity = await repository.getByUserId("user_1");
  assert.equal(identity.status, "success");
  if (identity.status === "success") {
    assert.equal(identity.value.state, "revoked");
    assert.equal((await repository.getByYouTubeIdentityId(identity.value.youtubeIdentityId)).status, "failure");
  }
});

test("a channel cannot be connected to two CreatorOS users", async () => {
  const { service } = harness();
  assert.equal((await service.connect("user_1", grant)).status, "success");
  const duplicate = await service.connect("user_2", { ...grant, providerUserId: "other-subject", refreshToken: "other-refresh" });
  assert.equal(duplicate.status, "failure");
  if (duplicate.status === "failure") assert.equal(duplicate.error.code, "channel-conflict");
});

test("connection rejects missing YouTube scope and first grants without refresh tokens", async () => {
  const { service } = harness();
  const missingScope = await service.connect("user_1", { ...grant, scopes: ["openid"] });
  const missingRefresh = await service.connect("user_1", { ...grant, refreshToken: undefined });
  assert.equal(missingScope.status, "failure");
  assert.equal(missingRefresh.status, "failure");
});

test("status is disconnected before authorization and after idempotent disconnect", async () => {
  const { service } = harness();
  assert.deepEqual(await service.getStatus("user_1"), { status: "success", value: { connected: false, scopes: [] } });
  assert.deepEqual(await service.disconnect("user_1"), { status: "success", value: { connected: false, scopes: [] } });
});
