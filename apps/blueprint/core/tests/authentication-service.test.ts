import assert from "node:assert/strict";
import { test } from "node:test";

import { AuthenticationService } from "../authentication";
import { InMemoryIdentityRepository, InMemoryUserRepository } from "../identity";
import { InMemorySessionRepository, SessionService } from "../session";
import { AUTH_TEST_EXPIRY, AUTH_TEST_TIME, AUTH_TEST_TOKEN_HASH, AuthenticationTestClock, identityInput, userInput } from "./fixtures/authentication-fixtures";

function services() {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryIdentityRepository(users);
  const sessionService = new SessionService(new InMemorySessionRepository(users), new AuthenticationTestClock([AUTH_TEST_TIME]));
  return { users, identities, authentication: new AuthenticationService(users, identities, sessionService) };
}

test("AuthenticationService creates a session for an active internal identity", async () => {
  const harness = services();
  await harness.users.create(userInput);
  await harness.identities.create(identityInput);
  const result = await harness.authentication.authenticateIdentity({ identityId: identityInput.identityId, sessionId: "auth_test_authenticated", tokenHash: AUTH_TEST_TOKEN_HASH, expiresAt: AUTH_TEST_EXPIRY, metadata: { clientType: "web", locale: "es" } });
  assert.equal(result.status, "authenticated");
  if (result.status === "authenticated") assert.equal(result.session.userId, userInput.userId);
});

test("AuthenticationService returns a safe failure for a missing identity", async () => {
  const result = await services().authentication.authenticateIdentity({ identityId: "missing", sessionId: "auth_test_missing", tokenHash: AUTH_TEST_TOKEN_HASH, expiresAt: AUTH_TEST_EXPIRY, metadata: { clientType: "web" } });
  assert.deepEqual(result, { status: "failure", error: { code: "identity-not-found", message: "Identity could not be authenticated." } });
});

test("AuthenticationService rejects disabled identities and inactive users", async () => {
  const disabledIdentity = services();
  await disabledIdentity.users.create(userInput);
  await disabledIdentity.identities.create({ ...identityInput, status: "disabled" });
  const first = await disabledIdentity.authentication.authenticateIdentity({ identityId: identityInput.identityId, sessionId: "auth_test_disabled", tokenHash: AUTH_TEST_TOKEN_HASH, expiresAt: AUTH_TEST_EXPIRY, metadata: { clientType: "web" } });
  assert.equal(first.status, "failure");
  if (first.status === "failure") assert.equal(first.error.code, "identity-disabled");

  const inactiveUser = services();
  await inactiveUser.users.create({ ...userInput, status: "suspended" });
  await inactiveUser.identities.create(identityInput);
  const second = await inactiveUser.authentication.authenticateIdentity({ identityId: identityInput.identityId, sessionId: "auth_test_inactive", tokenHash: AUTH_TEST_TOKEN_HASH, expiresAt: AUTH_TEST_EXPIRY, metadata: { clientType: "web" } });
  assert.equal(second.status, "failure");
  if (second.status === "failure") assert.equal(second.error.code, "user-inactive");
});
