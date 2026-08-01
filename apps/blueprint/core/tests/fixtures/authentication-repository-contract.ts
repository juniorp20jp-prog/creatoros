import assert from "node:assert/strict";
import { test } from "node:test";

import type { IdentityRepository, UserRepository } from "../../identity";
import type { CreateSessionInput, SessionRepository } from "../../session";
import { AUTH_TEST_LATER, identityInput, sessionInput, userInput } from "./authentication-fixtures";

export type AuthenticationRepositoryHarness = Readonly<{
  users: UserRepository;
  identities: IdentityRepository;
  sessions: SessionRepository;
  cleanup?: () => Promise<void> | void;
}>;
export type AuthenticationRepositoryFactory = () => AuthenticationRepositoryHarness | Promise<AuthenticationRepositoryHarness>;

async function withRepositories(factory: AuthenticationRepositoryFactory, operation: (harness: AuthenticationRepositoryHarness) => Promise<void>): Promise<void> {
  const harness = await factory();
  try { await operation(harness); } finally { await harness.cleanup?.(); }
}

export function runAuthenticationRepositoryContractTests(name: string, factory: AuthenticationRepositoryFactory): void {
  test(`${name}: creates and retrieves a normalized user`, async () => {
    await withRepositories(factory, async ({ users }) => {
      const created = await users.create(userInput);
      assert.equal(created.status, "success");
      if (created.status !== "success") return;
      assert.equal(created.value.email, "creator@example.com");
      assert.deepEqual(await users.getByEmail(" CREATOR@example.COM "), created);
      assert.deepEqual(await users.getById(userInput.userId), created);
    });
  });

  test(`${name}: controls duplicate users`, async () => {
    await withRepositories(factory, async ({ users }) => {
      await users.create(userInput);
      const duplicateId = await users.create({ ...userInput, email: "other@example.com" });
      const duplicateEmail = await users.create({ ...userInput, userId: "auth_test_other_user" });
      assert.equal(duplicateId.status, "failure");
      assert.equal(duplicateEmail.status, "failure");
      if (duplicateId.status === "failure") assert.equal(duplicateId.error.code, "duplicate-id");
      if (duplicateEmail.status === "failure") assert.equal(duplicateEmail.error.code, "duplicate-email");
    });
  });

  test(`${name}: creates and retrieves an identity for an existing user`, async () => {
    await withRepositories(factory, async ({ users, identities }) => {
      await users.create(userInput);
      const created = await identities.create(identityInput);
      assert.equal(created.status, "success");
      assert.deepEqual(await identities.getByUserId(userInput.userId), created);
      assert.deepEqual(await identities.getById(identityInput.identityId), created);
    });
  });

  test(`${name}: rejects orphaned and duplicate identities`, async () => {
    await withRepositories(factory, async ({ users, identities }) => {
      const orphaned = await identities.create(identityInput);
      assert.equal(orphaned.status, "failure");
      if (orphaned.status === "failure") assert.equal(orphaned.error.code, "user-not-found");
      await users.create(userInput);
      await identities.create(identityInput);
      const duplicate = await identities.create(identityInput);
      assert.equal(duplicate.status, "failure");
      if (duplicate.status === "failure") assert.equal(duplicate.error.code, "duplicate-id");
    });
  });

  test(`${name}: persists, lists, touches, and revokes sessions`, async () => {
    await withRepositories(factory, async ({ users, sessions }) => {
      await users.create(userInput);
      const created = await sessions.create(sessionInput);
      assert.equal(created.status, "success");
      const listed = await sessions.listByUserId(userInput.userId);
      assert.equal(listed.status, "success");
      if (listed.status === "success") assert.deepEqual(listed.value, created.status === "success" ? [created.value] : []);
      const touched = await sessions.updateLastActivity(sessionInput.sessionId, AUTH_TEST_LATER);
      assert.equal(touched.status, "success");
      if (touched.status === "success") assert.equal(touched.value.lastActivityAt, AUTH_TEST_LATER);
      const revoked = await sessions.revoke(sessionInput.sessionId, AUTH_TEST_LATER);
      assert.equal(revoked.status, "success");
      if (revoked.status === "success") assert.equal(revoked.value.revokedAt, AUTH_TEST_LATER);
    });
  });

  test(`${name}: controls orphaned, duplicate, and missing sessions`, async () => {
    await withRepositories(factory, async ({ users, sessions }) => {
      const orphaned = await sessions.create(sessionInput);
      assert.equal(orphaned.status, "failure");
      if (orphaned.status === "failure") assert.equal(orphaned.error.code, "user-not-found");
      await users.create(userInput);
      await sessions.create(sessionInput);
      const duplicate = await sessions.create(sessionInput);
      const missing = await sessions.getById("auth_test_missing_session");
      assert.equal(duplicate.status, "failure");
      assert.equal(missing.status, "failure");
      if (duplicate.status === "failure") assert.equal(duplicate.error.code, "duplicate-id");
      if (missing.status === "failure") assert.equal(missing.error.code, "not-found");
    });
  });

  test(`${name}: isolates caller metadata and exposes no secret-shaped fields`, async () => {
    await withRepositories(factory, async ({ users, sessions }) => {
      await users.create(userInput);
      const input: CreateSessionInput = {
        ...sessionInput,
        metadata: { ...sessionInput.metadata },
      };
      const created = await sessions.create(input);
      assert.equal(created.status, "success");
      (input.metadata as { clientType: "web" | "internal" }).clientType = "internal";
      const stored = await sessions.getById(sessionInput.sessionId);
      assert.equal(stored.status, "success");
      assert.equal(JSON.stringify(stored).includes("accessToken"), false);
      assert.equal(JSON.stringify(stored).includes("refreshToken"), false);
      if (stored.status === "success") assert.deepEqual(stored.value.metadata, sessionInput.metadata);
    });
  });
}
