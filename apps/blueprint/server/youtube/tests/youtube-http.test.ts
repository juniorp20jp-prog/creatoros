import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemorySessionRepository, InMemoryUserRepository, InMemoryYouTubeAuthorizationRepository, SessionService, YouTubeAuthorizationService, YOUTUBE_READONLY_SCOPE, type Clock, type IdGenerator, type RefreshedYouTubeGrant, type TokenProtectionResult, type YouTubeProviderResult, type YouTubeTokenProtector } from "../../../core";
import { AUTH_SESSION_COOKIE, CurrentSessionResolver, SessionTokenService } from "../../auth";
import { YouTubeAuthorizationStateStore } from "../authorization-state";
import { YOUTUBE_AUTH_STATE_COOKIE } from "../cookies";
import { YouTubeHttpHandlers } from "../youtube-http";
import type { YouTubeAuthorizationRequest, YouTubeOAuthProtocol, YouTubeProtocolResult } from "../openid-client-youtube-protocol";

const NOW = "2026-08-02T12:00:00.000Z";
const EXPIRY = "2026-08-03T12:00:00.000Z";
class StaticClock implements Clock { constructor(private readonly value = NOW) {} now(): string { return this.value; } }
class TestIds implements IdGenerator { private value = 0; create(prefix: string): string { return `${prefix}_${++this.value}`; } }
class TestProtector implements YouTubeTokenProtector { readonly activeKeyId = "test"; async protect(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: `encrypted:${value}` }; } async reveal(value: string): Promise<TokenProtectionResult<string>> { return { status: "success", value: value.replace(/^encrypted:/u, "") }; } }
class TestProtocol implements YouTubeOAuthProtocol {
  revokeCount = 0;
  lastPurpose = "initial-youtube-connection";
  decline = false;
  async begin(purpose: "initial-youtube-connection" | "analytics-scope-upgrade" = "initial-youtube-connection"): Promise<YouTubeAuthorizationRequest> { this.lastPurpose = purpose; return { authorizationUrl: new URL("https://accounts.google.com/o/oauth2/v2/auth?state=state&code_challenge=challenge&code_challenge_method=S256"), state: "state", nonce: "nonce", codeVerifier: "verifier" }; }
  async complete(callbackUrl: URL, transaction: Readonly<{ state: string }>): Promise<YouTubeProtocolResult<{ providerUserId: string; channelId: string; channelTitle: string; scopes: readonly string[]; refreshToken: string; accessToken: string }>> {
    if (this.decline) return { status: "failure", error: { code: "callback-invalid", message: "declined", stage: "authorization-callback", providerCode: "access_denied" } };
    if (callbackUrl.searchParams.get("state") !== transaction.state) {
      return { status: "failure", error: { code: "callback-invalid", message: "YouTube callback could not be verified.", stage: "authorization-state", providerCode: "authorization-state-mismatch" } };
    }
    return { status: "success", value: { providerUserId: "provider", channelId: "UC_http", channelTitle: "HTTP Channel", scopes: [YOUTUBE_READONLY_SCOPE], refreshToken: "refresh", accessToken: "access" } };
  }
  async refresh(): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>> { return { status: "success", value: { accessToken: "new-access" } }; }
  async revoke(): Promise<YouTubeProviderResult<true>> { this.revokeCount += 1; return { status: "success", value: true }; }
}

async function createHarness(clock: Clock = new StaticClock()) {
  const users = new InMemoryUserRepository();
  await users.create({ userId: "user_http", email: "http@example.com", displayName: "HTTP User", locale: "es", createdAt: NOW });
  const sessions = new InMemorySessionRepository(users);
  const sessionTokens = new SessionTokenService("test-cookie-secret-that-is-at-least-32-characters");
  const token = await sessionTokens.generate();
  await new SessionService(sessions, clock).createSession({ sessionId: "session_http", userId: "user_http", tokenHash: token.tokenHash, expiresAt: EXPIRY, metadata: { clientType: "web", locale: "es" } });
  const protocol = new TestProtocol();
  const repository = new InMemoryYouTubeAuthorizationRepository();
  const service = new YouTubeAuthorizationService(repository, new TestProtector(), protocol, clock, new TestIds());
  const authorizationStates = new YouTubeAuthorizationStateStore(clock);
  let analyticsState = "not-authorized";
  const analytics = { recordCapability: async (_userId: string, state: string) => { analyticsState = state; return { status: "success" as const, value: { userId: "user_http", state, updatedAt: NOW } }; } } as unknown as import("../../../core").YouTubeAnalyticsCollectionService;
  const handlers = new YouTubeHttpHandlers({ currentSession: new CurrentSessionResolver(sessions, users, sessionTokens, clock), compositionFactory: async () => ({ status: "success", value: { service, protocol, analytics } }), authorizationStates, clock, ids: new TestIds(), production: false });
  return { handlers, protocol, authorizationStates, sessionCookie: `${AUTH_SESSION_COOKIE}=${token.token}`, getAnalyticsState: () => analyticsState };
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
  assert.match(connect.headers.get("location") ?? "", /code_challenge_method=S256/u);
  const stateCookie = connect.headers.get("set-cookie")?.split(";")[0];
  assert.ok(stateCookie);
  const callback = await handlers.callback(new Request("http://localhost/api/youtube/callback?state=state&code=private-code", { headers: { cookie: `${sessionCookie}; ${stateCookie}` } }));
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "http://localhost/es/youtube-analyzer");
  const status = await handlers.status(new Request("http://localhost/api/youtube/status", { headers: { cookie: sessionCookie } }));
  assert.equal(status.status, 200);
  assert.equal((await status.json() as { data: { connected: boolean } }).data.connected, true);
});

test("Analytics connect records a server-side incremental purpose", async () => {
  const { handlers, protocol, sessionCookie } = await createHarness();
  const response = await handlers.connect(new Request("http://localhost/api/youtube/analytics/connect", { headers: { cookie: sessionCookie } }), "analytics-scope-upgrade");
  assert.equal(response.status, 302);
  assert.equal(protocol.lastPurpose, "analytics-scope-upgrade");
});

test("declined Analytics consent preserves the existing Data API connection", async () => {
  const { handlers, protocol, sessionCookie, getAnalyticsState } = await createHarness();
  const initial = await handlers.connect(new Request("http://localhost/api/youtube/connect", { headers: { cookie: sessionCookie } }));
  await handlers.callback(new Request("http://localhost/api/youtube/callback?state=state&code=code", { headers: { cookie: `${sessionCookie}; ${initial.headers.get("set-cookie")?.split(";")[0]}` } }));
  protocol.decline = true;
  const upgrade = await handlers.connect(new Request("http://localhost/api/youtube/analytics/connect", { headers: { cookie: sessionCookie } }), "analytics-scope-upgrade");
  const callback = await handlers.callback(new Request("http://localhost/api/youtube/callback?error=access_denied&state=state", { headers: { cookie: `${sessionCookie}; ${upgrade.headers.get("set-cookie")?.split(";")[0]}` } }));
  assert.equal(callback.status, 302);
  assert.match(callback.headers.get("location") ?? "", /analytics=declined/u);
  assert.equal(getAnalyticsState(), "declined");
  const status = await handlers.status(new Request("http://localhost/api/youtube/status", { headers: { cookie: sessionCookie } }));
  assert.equal((await status.json() as { data: { connected: boolean; scopes: string[] } }).data.connected, true);
});

test("callback without the transient state cookie fails safely and clears its cookie scope", async () => {
  const { handlers, sessionCookie } = await createHarness();
  const callback = await handlers.callback(new Request("http://localhost/api/youtube/callback?state=state&code=private-code", { headers: { cookie: sessionCookie } }));
  assert.equal(callback.status, 400);
  assert.deepEqual(await callback.json(), { error: { code: "YOUTUBE_AUTHORIZATION_FAILED", message: "YouTube authorization could not be completed." } });
  assert.equal(callback.headers.get("set-cookie"), `${YOUTUBE_AUTH_STATE_COOKIE}=; Path=/api/youtube; HttpOnly; SameSite=Lax; Max-Age=0`);
});

test("callback state is single-use and cannot be replayed", async () => {
  const { handlers, sessionCookie } = await createHarness();
  const connect = await handlers.connect(new Request("http://localhost/api/youtube/connect", { headers: { cookie: sessionCookie } }));
  const stateCookie = connect.headers.get("set-cookie")?.split(";")[0];
  assert.ok(stateCookie);
  const cookie = `${sessionCookie}; ${stateCookie}`;
  const callbackUrl = "http://localhost/api/youtube/callback?state=state&code=private-code";
  assert.equal((await handlers.callback(new Request(callbackUrl, { headers: { cookie } }))).status, 302);
  assert.equal((await handlers.callback(new Request(callbackUrl, { headers: { cookie } }))).status, 400);
});

test("expired authorization state fails before protocol completion", async () => {
  const clock = new StaticClock("2026-08-02T12:11:00.000Z");
  const { handlers, authorizationStates, sessionCookie } = await createHarness(clock);
  authorizationStates.save("expired-handle", { userId: "user_http", purpose: "initial-youtube-connection", state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/es/youtube-analyzer", createdAt: NOW, expiresAt: "2026-08-02T12:10:00.000Z" });
  const cookie = `${sessionCookie}; ${YOUTUBE_AUTH_STATE_COOKIE}=expired-handle`;
  const callback = await handlers.callback(new Request("http://localhost/api/youtube/callback?state=state&code=private-code", { headers: { cookie } }));
  assert.equal(callback.status, 400);
});

test("callback rejects a mismatched OAuth state", async () => {
  const { handlers, sessionCookie } = await createHarness();
  const connect = await handlers.connect(new Request("http://localhost/api/youtube/connect", { headers: { cookie: sessionCookie } }));
  const stateCookie = connect.headers.get("set-cookie")?.split(";")[0];
  assert.ok(stateCookie);
  const callback = await handlers.callback(new Request("http://localhost/api/youtube/callback?state=other-state&code=private-code", { headers: { cookie: `${sessionCookie}; ${stateCookie}` } }));
  assert.equal(callback.status, 400);
  const status = await handlers.status(new Request("http://localhost/api/youtube/status", { headers: { cookie: sessionCookie } }));
  assert.equal((await status.json() as { data: { connected: boolean } }).data.connected, false);
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
