import assert from "node:assert/strict";
import { test } from "node:test";

import { ChannelSynchronizationService, InMemoryChannelSynchronizationRepository, InMemorySessionRepository, InMemoryUserRepository, InMemoryYouTubeAuthorizationRepository, SessionService, YouTubeAuthorizationService, YOUTUBE_READONLY_SCOPE, type Clock, type IdGenerator, type RefreshedYouTubeGrant, type TokenProtectionResult, type YouTubeApiAdapter, type YouTubeAuthorizationProvider, type YouTubeChannelApiResult, type YouTubeProviderResult, type YouTubeTokenProtector } from "../../../core";
import { AUTH_SESSION_COOKIE, CurrentSessionResolver, SessionTokenService } from "../../auth";
import { ChannelSyncHttpHandlers } from "../channel-sync-http";

const NOW = "2026-08-03T12:00:00.000Z";
const EXPIRY = "2026-08-04T12:00:00.000Z";
const channel = { channelId: "UC_http_sync", title: "HTTP Channel", description: "HTTP channel", publishedAt: "2020-01-01T00:00:00.000Z", viewCount: "10", videoCount: "2", hiddenSubscriberCount: true, keywords: [], brandingSettings: { keywords: [] }, privacyStatus: "public" as const };
class TestClock implements Clock { now(): string { return NOW; } }
class TestIds implements IdGenerator { private value = 0; create(prefix: string): string { return `${prefix}_${++this.value}`; } }
class Protector implements YouTubeTokenProtector { readonly activeKeyId = "test"; async protect(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: `encrypted:${value}` }; } async reveal(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: value.replace(/^encrypted:/u, "") }; } }
class Provider implements YouTubeAuthorizationProvider { async refresh(): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>> { return { status: "success", value: { accessToken: "refreshed", accessTokenExpiresAt: EXPIRY } }; } async revoke(): Promise<YouTubeProviderResult<true>> { return { status: "success", value: true }; } }
class Api implements YouTubeApiAdapter { constructor(private readonly result: YouTubeChannelApiResult) {} async fetchAuthenticatedChannel(): Promise<YouTubeChannelApiResult> { return this.result; } }

async function harness(apiResult: YouTubeChannelApiResult) {
  const clock = new TestClock();
  const ids = new TestIds();
  const users = new InMemoryUserRepository();
  await users.create({ userId: "user_channel_http", email: "channel-http@example.com", displayName: "Channel HTTP", locale: "es", createdAt: NOW });
  const sessions = new InMemorySessionRepository(users);
  const sessionTokens = new SessionTokenService("channel-http-cookie-secret-at-least-32-characters");
  const sessionToken = await sessionTokens.generate();
  await new SessionService(sessions, clock).createSession({ sessionId: "session_channel_http", userId: "user_channel_http", tokenHash: sessionToken.tokenHash, expiresAt: EXPIRY, metadata: { clientType: "web" } });
  const protector = new Protector();
  const provider = new Provider();
  const authorizations = new InMemoryYouTubeAuthorizationRepository();
  const authorizationService = new YouTubeAuthorizationService(authorizations, protector, provider, clock, ids);
  await authorizationService.connect("user_channel_http", { providerUserId: "provider", channelId: channel.channelId, channelTitle: channel.title, scopes: [YOUTUBE_READONLY_SCOPE], refreshToken: "refresh", accessToken: "access", accessTokenExpiresAt: EXPIRY });
  const service = new ChannelSynchronizationService(new InMemoryChannelSynchronizationRepository(), authorizations, authorizationService, protector, new Api(apiResult), clock, ids);
  return { handlers: new ChannelSyncHttpHandlers(new CurrentSessionResolver(sessions, users, sessionTokens, clock), async () => service), cookie: `${AUTH_SESSION_COOKIE}=${sessionToken.token}` };
}

test("channel synchronization endpoints require CreatorOS authentication", async () => {
  const { handlers } = await harness({ status: "success", value: channel });
  assert.equal((await handlers.synchronize(new Request("http://localhost/api/youtube/channel/sync", { method: "POST" }))).status, 401);
  assert.equal((await handlers.channel(new Request("http://localhost/api/youtube/channel"))).status, 401);
  assert.equal((await handlers.status(new Request("http://localhost/api/youtube/channel/status"))).status, 401);
});

test("HTTP synchronization, channel and status expose safe read models", async () => {
  const { handlers, cookie } = await harness({ status: "success", value: channel });
  const synchronized = await handlers.synchronize(new Request("http://localhost/api/youtube/channel/sync", { method: "POST", headers: { cookie } }));
  assert.equal(synchronized.status, 200);
  const channelResponse = await handlers.channel(new Request("http://localhost/api/youtube/channel", { headers: { cookie } }));
  const statusResponse = await handlers.status(new Request("http://localhost/api/youtube/channel/status", { headers: { cookie } }));
  assert.equal(channelResponse.status, 200);
  assert.equal(statusResponse.status, 200);
  const serialized = `${await channelResponse.text()}${await statusResponse.text()}`;
  for (const forbidden of ["access", "refresh", "authorizationCode", "idToken", "claims"]) assert.equal(serialized.includes(forbidden), false);
});

test("HTTP maps quota exceeded to a stable safe response", async () => {
  const { handlers, cookie } = await harness({ status: "failure", error: { code: "quota-exceeded", message: "provider details" } });
  const response = await handlers.synchronize(new Request("http://localhost/api/youtube/channel/sync", { method: "POST", headers: { cookie } }));
  assert.equal(response.status, 429);
  assert.equal((await response.text()).includes("provider details"), false);
});
