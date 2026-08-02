import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemorySessionRepository, InMemoryUserRepository, InMemoryYouTubeAuthorizationRepository, SessionService, YouTubeAuthorizationService, YOUTUBE_READONLY_SCOPE, type Clock, type IdGenerator, type RefreshedYouTubeGrant, type TokenProtectionResult, type YouTubeProviderResult, type YouTubeTokenProtector } from "../../../core";
import { AUTH_SESSION_COOKIE, CurrentSessionResolver, SessionTokenService } from "../../auth";
import { YouTubeAuthorizationStateStore } from "../authorization-state";
import { YouTubeHttpHandlers } from "../youtube-http";
import type { YouTubeAuthorizationRequest, YouTubeOAuthProtocol, YouTubeProtocolResult } from "../openid-client-youtube-protocol";

const NOW = "2026-08-02T12:00:00.000Z";
const EXPIRY = "2026-08-03T12:00:00.000Z";
class StaticClock implements Clock { now(): string { return NOW; } }
class TestIds implements IdGenerator { private value = 0; create(prefix: string): string { return `${prefix}_${++this.value}`; } }
class TestProtector implements YouTubeTokenProtector { readonly activeKeyId = "test"; async protect(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: `encrypted:${value}` }; } async reveal(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: value.replace(/^encrypted:/u, "") }; } }
class TestProtocol implements YouTubeOAuthProtocol {
  revokeCount = 0;
  async begin(): Promise<YouTubeAuthorizationRequest> { return { authorizationUrl: new URL("https://accounts.google.com/o/oauth2/v2/auth?state=state&code_challenge=challenge"), state: "state", nonce: "nonce", codeVerifier: "verifier" }; }
  async complete(): Promise<YouTubeProtocolResult<{ providerUserId: string; channelId: string; channelTitle: string; scopes: readonly string[]; refreshToken: string; accessToken: string }>> { return { status: "success", value: { providerUserId: "provider", channelId: "UC_http", channelTitle: "HTTP Channel", scopes: [YOUTUBE_READONLY_SCOPE], refreshToken: "refresh", accessToken: "access" } }; }
  async refresh(): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>> { return { status: "success", value: { accessToken: "new-access" } }; }
  async revoke(): Promise<YouTubeProviderResult<true>> { this.revokeCount += 1; return { status: "success", value: true }; }
}

async function createHarness() {
  const clock = new StaticClock();
  const users = new InMemoryUserRepository();
  await users.create({ userId: "user_http", email: "http@example.com", displayName: "HTTP User", locale: "es", createdAt: NOW });
  const sessions = new InMemorySessionRepository(users);
  const sessionTokens = new SessionTokenService("test-cookie-secret-that-is-at-least-32-characters");
  const token = await sessionTokens.generate();
  await new SessionService(sessions, clock).createSession({ sessionId: "session_http", userId: "user_http", tokenHash: token.tokenHash, expiresAt: EXPIRY, metadata: { clientType: "web", locale: "es" } });
  const protocol = new TestProtocol();
  const repository = new InMemoryYouTubeAuthorizationRepository();
  const service = new YouTubeAuthorizationService(repository, new TestProtector(), protocol, clock, new TestIds());
  const handlers = new YouTubeHttpHandlers({ currentSession: new CurrentSessionResolver(sessions, users, sessionTokens, clock), compositionFactory: async () => ({ status: "success", value: { service, protocol } }), authorizationStates: new YouTubeAuthorizationStateStore(clock), clock, ids: new TestIds(), production: false });
  return { handlers, protocol, sessionCookie: `${AUTH_SESSION_COOKIE}=${token.token}` };
}

test("YouTube endpoints require an authenticated CreatorOS session", async () => {
  const { handlers } = await createHarness();
  assert.equal((await handlers.connect(new Request("http://localhost/api/youtube/connect"))).status, 401);
  assert.equal((await handlers.status(new Request("http://localhost/api/youtube/status"))).status, 401);
  assert.equal((await handlers.disconnect(new Request("http://localhost/api/youtube/disconnect", { method: "POST" }))).status, 401);
});

test("connect and callback use state, PKCE transaction, safe cookies and persist a connection", async () => {
  const { handlers, sessionCookie } = await createHarness();
  const connect = await handlers.connect(new Request("http://localhost/api/youtube/connect?returnTo=/es/youtube-analyzer", { headers: { cookie: sessionCookie } }));
  assert.equal(connect.status, 302);
  assert.match(connect.headers.get("location") ?? "", /code_challenge/u);
  const stateCookie = connect.headers.get("set-cookie")?.split(";")[0];
  assert.ok(stateCookie);
  const callback = await handlers.callback(new Request("http://localhost/api/youtube/callback?state=state&code=private-code", { headers: { cookie: `${sessionCookie}; ${stateCookie}` } }));
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "http://localhost/es/youtube-analyzer");
  const status = await handlers.status(new Request("http://localhost/api/youtube/status", { headers: { cookie: sessionCookie } }));
  assert.equal(status.status, 200);
  assert.equal((await status.json() as { data: { connected: boolean } }).data.connected, true);
});

test("disconnect revokes provider access and returns a safe disconnected status", async () => {
  const { handlers, protocol, sessionCookie } = await createHarness();
  const connect = await handlers.connect(new Request("http://localhost/api/youtube/connect", { headers: { cookie: sessionCookie } }));
  const stateCookie = connect.headers.get("set-cookie")?.split(";")[0];
  await handlers.callback(new Request("http://localhost/api/youtube/callback?state=state&code=private-code", { headers: { cookie: `${sessionCookie}; ${stateCookie}` } }));
  const response = await handlers.disconnect(new Request("http://localhost/api/youtube/disconnect", { method: "POST", headers: { cookie: sessionCookie } }));
  assert.equal(response.status, 200);
  assert.equal(protocol.revokeCount, 1);
  const body = await response.json() as { data: { connected: boolean } };
  assert.equal(body.data.connected, false);
  assert.equal(JSON.stringify(body).includes("refresh"), false);
});
