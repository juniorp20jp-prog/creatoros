import assert from "node:assert/strict";
import { test } from "node:test";

import { AuthenticationService, ExternalIdentityAuthenticationService, InMemoryIdentityRepository, InMemorySessionRepository, InMemoryUserRepository, SessionService, type ExternalIdentityProvisioner, type IdGenerator } from "../../../core";
import { AuthenticationTestClock, AUTH_TEST_TIME } from "../../../core/tests/fixtures/authentication-fixtures";
import { AuthHttpHandlers } from "../auth-http";
import { InMemoryAuthorizationStateStore } from "../authorization-state";
import { readAuthConfiguration } from "../config";
import { CurrentSessionResolver } from "../current-session";
import { GoogleOidcIdentityAdapter, type GoogleOidcProtocol } from "../oidc/google-oidc-adapter";
import { SessionTokenService } from "../session-token";

class TestIds implements IdGenerator {
  private value = 0;
  create(prefix: string): string { this.value += 1; return `${prefix}_test_${this.value}`; }
}

class Protocol implements GoogleOidcProtocol {
  async createAuthorizationRequest(redirectUri: string) {
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({ redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state: "state_http", nonce: "nonce_http", code_challenge: "challenge_http", code_challenge_method: "S256" }).toString();
    return { authorizationUrl, state: "state_http", nonce: "nonce_http", codeVerifier: "verifier_http" };
  }
  async exchangeCallback() {
    return { iss: "https://accounts.google.com", aud: "client_http", exp: 1_900_000_000, nonce: "nonce_http", sub: "google_http", email: "http@example.com", email_verified: true, name: "HTTP Creator", locale: "fr" };
  }
}

function createHandlers() {
  const clock = new AuthenticationTestClock(Array.from({ length: 30 }, () => AUTH_TEST_TIME));
  const users = new InMemoryUserRepository();
  const identities = new InMemoryIdentityRepository(users);
  const sessions = new InMemorySessionRepository(users);
  const sessionService = new SessionService(sessions, clock);
  const provisioner: ExternalIdentityProvisioner = {
    async resolveOrProvision(input) {
      const existing = await identities.getByProviderSubject(input.externalIdentity.provider, input.externalIdentity.providerSubject);
      if (existing.status === "success") {
        const user = await users.getById(existing.value.userId);
        return user.status === "success" ? { status: "success", identity: existing.value, user: user.value, provisioned: false } : { status: "failure", error: { code: "persistence-failure", message: "Controlled failure." } };
      }
      if ((await users.getByEmail(input.externalIdentity.email)).status === "success") return { status: "failure", error: { code: "identity-conflict", message: "Controlled conflict." } };
      const user = await users.create({ userId: input.userId, email: input.externalIdentity.email, displayName: input.externalIdentity.displayName ?? input.externalIdentity.email, locale: input.locale, createdAt: input.createdAt });
      if (user.status === "failure") return { status: "failure", error: { code: "user-provisioning-failed", message: "Controlled failure." } };
      const identity = await identities.create({ identityId: input.identityId, userId: input.userId, provider: "google", providerSubject: input.externalIdentity.providerSubject, createdAt: input.createdAt });
      return identity.status === "success" ? { status: "success", user: user.value, identity: identity.value, provisioned: true } : { status: "failure", error: { code: "user-provisioning-failed", message: "Controlled failure." } };
    },
  };
  const tokens = new SessionTokenService();
  return new AuthHttpHandlers({
    adapterFactory: async () => ({ status: "success", value: new GoogleOidcIdentityAdapter(new Protocol(), "client_http", "http://localhost:3002/api/auth/google/callback", clock) }),
    authorizationStates: new InMemoryAuthorizationStateStore(clock),
    externalAuthentication: new ExternalIdentityAuthenticationService(provisioner, new AuthenticationService(users, identities, sessionService)),
    sessionService,
    currentSession: new CurrentSessionResolver(sessions, users, tokens, clock),
    tokens,
    clock,
    ids: new TestIds(),
    production: true,
  });
}

test("auth configuration validates required environment without exposing values", () => {
  assert.equal(readAuthConfiguration({}).status, "failure");
  const result = readAuthConfiguration({ GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", GOOGLE_REDIRECT_URI: "http://localhost:3002/api/auth/google/callback", APP_BASE_URL: "http://localhost:3002", AUTH_COOKIE_SECRET: "x".repeat(32), NODE_ENV: "development" });
  assert.equal(result.status, "success");
  assert.doesNotMatch(JSON.stringify(readAuthConfiguration({})), /client|secret/i);
});

test("login and callback provision identity, create opaque session, and redirect safely", async () => {
  const handlers = createHandlers();
  const login = await handlers.login(new Request("http://localhost:3002/api/auth/google?returnTo=%2Ffr%2Fmission-control"));
  assert.equal(login.status, 302);
  assert.match(login.headers.get("location") ?? "", /accounts\.google\.com/);
  const stateCookie = cookiePair(login.headers.get("set-cookie"), "creatoros_auth_state");
  const callback = await handlers.callback(new Request("http://localhost:3002/api/auth/google/callback?code=code_http&state=state_http", { headers: { cookie: stateCookie } }));
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "http://localhost:3002/fr/mission-control");
  const session = callback.headers.get("set-cookie") ?? "";
  assert.match(session, /creatoros_session=/);
  assert.doesNotMatch(session, /http@example|google_http|code_http/);
});

test("temporary callback state is single-use and provider errors clear it", async () => {
  const handlers = createHandlers();
  const login = await handlers.login(new Request("http://localhost:3002/api/auth/google"));
  const cookie = cookiePair(login.headers.get("set-cookie"), "creatoros_auth_state");
  const callbackUrl = "http://localhost:3002/api/auth/google/callback?code=code&state=state_http";
  assert.equal((await handlers.callback(new Request(callbackUrl, { headers: { cookie } }))).status, 302);
  const replay = await handlers.callback(new Request(callbackUrl, { headers: { cookie } }));
  assert.equal(replay.status, 400);
  assert.match(replay.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("session, protection, and idempotent logout use the CreatorOS session", async () => {
  const handlers = createHandlers();
  const login = await handlers.login(new Request("http://localhost:3002/api/auth/google"));
  const stateCookie = cookiePair(login.headers.get("set-cookie"), "creatoros_auth_state");
  const callback = await handlers.callback(new Request("http://localhost:3002/api/auth/google/callback?code=code&state=state_http", { headers: { cookie: stateCookie } }));
  const sessionCookie = cookiePair(callback.headers.get("set-cookie"), "creatoros_session");
  const request = new Request("http://localhost:3002/api/auth/session", { headers: { cookie: sessionCookie } });
  assert.equal((await handlers.session(request)).status, 200);
  assert.equal((await handlers.protect(request, async () => new Response(null, { status: 204 }))).status, 204);
  const logout = await handlers.logout(request);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.equal((await handlers.protect(request, async () => new Response())).status, 401);
  assert.equal((await handlers.logout(new Request("http://localhost"))).status, 200);
});

test("anonymous and altered-cookie route protection returns a safe 401 envelope", async () => {
  const handlers = createHandlers();
  for (const request of [new Request("http://localhost"), new Request("http://localhost", { headers: { cookie: "creatoros_session=altered" } })]) {
    const response = await handlers.protect(request, async () => new Response());
    assert.equal(response.status, 401);
    const serialized = await response.text();
    assert.match(serialized, /AUTHENTICATION_REQUIRED/);
    assert.doesNotMatch(serialized, /Prisma|postgresql|token|secret/i);
  }
});

function cookiePair(header: string | null, name: string): string {
  const match = header?.match(new RegExp(`${name}=[^;,]+`));
  if (!match) throw new Error(`Cookie ${name} was not set.`);
  return match[0];
}
