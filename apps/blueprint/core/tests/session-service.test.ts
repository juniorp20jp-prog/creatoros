import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryUserRepository } from "../identity";
import { createSession, InMemorySessionRepository, SessionService } from "../session";
import { AUTH_TEST_EXPIRY, AUTH_TEST_LATER, AUTH_TEST_TIME, AuthenticationTestClock, sessionInput, userInput } from "./fixtures/authentication-fixtures";

test("Session validates expiration without transport credentials", () => {
  assert.equal(createSession(sessionInput).status, "success");
  assert.equal(createSession({ ...sessionInput, expiresAt: AUTH_TEST_TIME }).status, "failure");
  assert.deepEqual(Object.keys(sessionInput.metadata).sort(), ["clientType", "locale"]);
});

test("SessionService creates and resolves an active session", async () => {
  const users = new InMemoryUserRepository();
  await users.create(userInput);
  const service = new SessionService(new InMemorySessionRepository(users), new AuthenticationTestClock([AUTH_TEST_TIME, AUTH_TEST_LATER]));
  const created = await service.createSession({ sessionId: sessionInput.sessionId, userId: sessionInput.userId, expiresAt: AUTH_TEST_EXPIRY, metadata: sessionInput.metadata });
  assert.equal(created.status, "success");
  const resolved = await service.getSession(sessionInput.sessionId);
  assert.equal(resolved.status, "success");
  if (resolved.status === "success") assert.equal(resolved.value.state, "active");
});

test("SessionService resolves expiry and revocation deterministically", async () => {
  const users = new InMemoryUserRepository();
  await users.create(userInput);
  const repository = new InMemorySessionRepository(users);
  await repository.create(sessionInput);
  const expired = await new SessionService(repository, new AuthenticationTestClock([AUTH_TEST_EXPIRY])).getSession(sessionInput.sessionId);
  assert.equal(expired.status, "success");
  if (expired.status === "success") assert.equal(expired.value.state, "expired");
  const service = new SessionService(repository, new AuthenticationTestClock([AUTH_TEST_LATER, AUTH_TEST_LATER]));
  assert.equal((await service.revokeSession(sessionInput.sessionId)).status, "success");
  const revoked = await service.getSession(sessionInput.sessionId);
  assert.equal(revoked.status, "success");
  if (revoked.status === "success") assert.equal(revoked.value.state, "revoked");
});
