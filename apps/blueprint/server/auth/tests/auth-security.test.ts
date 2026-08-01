import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemorySessionRepository, InMemoryUserRepository } from "../../../core";
import { AuthenticationTestClock, AUTH_TEST_EXPIRY, AUTH_TEST_LATER, AUTH_TEST_TIME, userInput } from "../../../core/tests/fixtures/authentication-fixtures";
import { InMemoryAuthorizationStateStore, safeReturnTo } from "../authorization-state";
import { authorizationStateCookie, clearSessionCookie, sessionCookie } from "../cookies";
import { CurrentSessionResolver } from "../current-session";
import { SessionTokenService } from "../session-token";

test("temporary authorization state expires and is consumed exactly once", () => {
  const store = new InMemoryAuthorizationStateStore(new AuthenticationTestClock([AUTH_TEST_TIME, AUTH_TEST_LATER]));
  store.save("handle", { state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/es/mission-control", createdAt: AUTH_TEST_TIME, expiresAt: AUTH_TEST_EXPIRY });
  assert.equal(store.consume("handle").status, "success");
  assert.equal(store.consume("handle").status, "failure");

  const expired = new InMemoryAuthorizationStateStore(new AuthenticationTestClock([AUTH_TEST_EXPIRY]));
  expired.save("expired", { state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/es/mission-control", createdAt: AUTH_TEST_TIME, expiresAt: AUTH_TEST_LATER });
  const result = expired.consume("expired");
  assert.equal(result.status, "failure");
  if (result.status === "failure") assert.equal(result.error.code, "authorization-state-expired");
});

test("returnTo allowlist rejects open redirects", () => {
  for (const value of ["https://evil.example", "//evil.example", "/admin", "/es/mission-control?next=evil"]) assert.equal(safeReturnTo(value), "/es/mission-control");
  assert.equal(safeReturnTo("/pt-BR/mission-control"), "/pt-BR/mission-control");
});

test("authorization and session cookies have secure server-only flags", () => {
  const temporary = authorizationStateCookie("opaque", true);
  const session = sessionCookie("opaque", true, 60);
  for (const value of [temporary, session]) {
    assert.match(value, /HttpOnly/);
    assert.match(value, /SameSite=Lax/);
    assert.match(value, /Secure/);
  }
  assert.match(temporary, /Path=\/api\/auth\/google/);
  assert.match(clearSessionCookie(true), /Max-Age=0/);
});

test("session tokens are random, opaque, and persist only a SHA-256 hash", async () => {
  const service = new SessionTokenService("test-secret-that-is-at-least-32-characters");
  const first = await service.generate();
  const second = await service.generate();
  assert.notEqual(first.token, second.token);
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(await service.hash(first.token), first.tokenHash);
});

async function resolverHarness(input: { userStatus?: "active" | "disabled"; expiresAt?: string; revokedAt?: string; now?: string }) {
  const users = new InMemoryUserRepository();
  await users.create({ ...userInput, status: input.userStatus ?? "active" });
  const sessions = new InMemorySessionRepository(users);
  const tokens = new SessionTokenService();
  const pair = await tokens.generate();
  await sessions.create({ sessionId: "auth_test_resolver", userId: userInput.userId, tokenHash: pair.tokenHash, createdAt: AUTH_TEST_TIME, expiresAt: input.expiresAt ?? AUTH_TEST_EXPIRY, metadata: { clientType: "web" } });
  if (input.revokedAt) await sessions.revoke("auth_test_resolver", input.revokedAt);
  return { pair, sessions, resolver: new CurrentSessionResolver(sessions, users, tokens, new AuthenticationTestClock([input.now ?? AUTH_TEST_LATER])) };
}

test("current-session resolver authenticates a valid opaque cookie", async () => {
  const harness = await resolverHarness({});
  const result = await harness.resolver.resolveCurrentSession(new Request("http://localhost", { headers: { cookie: `creatoros_session=${harness.pair.token}` } }));
  assert.equal(result.status, "authenticated");
  if (result.status === "authenticated") assert.equal(result.principal.userId, userInput.userId);
});

test("current-session resolver controls missing and altered cookies", async () => {
  const harness = await resolverHarness({});
  assert.deepEqual(await harness.resolver.resolveCurrentSession(new Request("http://localhost")), { status: "anonymous", reason: "missing" });
  assert.deepEqual(await harness.resolver.resolveCurrentSession(new Request("http://localhost", { headers: { cookie: "creatoros_session=altered" } })), { status: "anonymous", reason: "invalid" });
});

test("current-session resolver rejects expired, revoked, and disabled-user sessions", async () => {
  const expired = await resolverHarness({ now: AUTH_TEST_EXPIRY });
  const revoked = await resolverHarness({ revokedAt: AUTH_TEST_LATER });
  const disabled = await resolverHarness({ userStatus: "disabled" });
  assert.equal((await expired.resolver.resolveCurrentSession(request(expired.pair.token))).status, "anonymous");
  assert.equal((await revoked.resolver.resolveCurrentSession(request(revoked.pair.token))).status, "anonymous");
  assert.equal((await disabled.resolver.resolveCurrentSession(request(disabled.pair.token))).status, "anonymous");
});

test("current-session resolver touches activity only after the five-minute window", async () => {
  const harness = await resolverHarness({ now: AUTH_TEST_LATER });
  await harness.resolver.resolveCurrentSession(request(harness.pair.token));
  const stored = await harness.sessions.getById("auth_test_resolver");
  assert.equal(stored.status, "success");
  if (stored.status === "success") assert.equal(stored.value.lastActivityAt, AUTH_TEST_LATER);
});

function request(token: string): Request {
  return new Request("http://localhost", { headers: { cookie: `creatoros_session=${token}` } });
}
