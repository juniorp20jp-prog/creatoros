import assert from "node:assert/strict";
import { test } from "node:test";

import { AuthenticationService } from "../../authentication";
import { PrismaExternalIdentityProvisioner, PrismaIdentityRepository, PrismaSessionRepository, PrismaUserRepository, createAnalysisRunPrismaClient } from "../../persistence/prisma";
import { SessionService } from "../../session";
import { runAuthenticationRepositoryContractTests } from "../fixtures/authentication-repository-contract";
import { AUTH_TEST_EXPIRY, AUTH_TEST_LATER, AUTH_TEST_TIME, AUTH_TEST_TOKEN_HASH, AuthenticationTestClock, identityInput, sessionInput, userInput } from "../fixtures/authentication-fixtures";
import { deleteOwnedPostgresTestRows, requireTestDatabaseUrl } from "./postgres-test-harness";
import { CurrentSessionResolver, SessionTokenService } from "../../../server/auth";

function repositories() {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  const users = new PrismaUserRepository(owned.client);
  return {
    owned,
    users,
    identities: new PrismaIdentityRepository(owned.client),
    sessions: new PrismaSessionRepository(owned.client),
  };
}

runAuthenticationRepositoryContractTests("Authentication repositories/PostgreSQL", async () => {
  const harness = repositories();
  await deleteOwnedPostgresTestRows(harness.owned);
  return {
    users: harness.users,
    identities: harness.identities,
    sessions: harness.sessions,
    cleanup: async () => {
      await deleteOwnedPostgresTestRows(harness.owned);
      await harness.owned.disconnect();
    },
  };
});

test("PostgreSQL authentication records survive repository recreation", async () => {
  const first = repositories();
  await deleteOwnedPostgresTestRows(first.owned);
  try {
    assert.equal((await first.users.create(userInput)).status, "success");
    assert.equal((await first.identities.create(identityInput)).status, "success");
    assert.equal((await first.sessions.create(sessionInput)).status, "success");
  } finally { await first.owned.disconnect(); }

  const second = repositories();
  try {
    assert.equal((await second.users.getById(userInput.userId)).status, "success");
    assert.equal((await second.identities.getById(identityInput.identityId)).status, "success");
    assert.equal((await second.sessions.getById(sessionInput.sessionId)).status, "success");
  } finally {
    await deleteOwnedPostgresTestRows(second.owned);
    await second.owned.disconnect();
  }
});

test("AuthenticationService composes Prisma repositories without provider credentials", async () => {
  const harness = repositories();
  await deleteOwnedPostgresTestRows(harness.owned);
  try {
    await harness.users.create(userInput);
    await harness.identities.create(identityInput);
    const service = new AuthenticationService(
      harness.users,
      harness.identities,
      new SessionService(harness.sessions, new AuthenticationTestClock([AUTH_TEST_TIME])),
    );
    const result = await service.authenticateIdentity({ identityId: identityInput.identityId, sessionId: "auth_test_service_session", tokenHash: AUTH_TEST_TOKEN_HASH, expiresAt: AUTH_TEST_EXPIRY, metadata: { clientType: "internal" } });
    assert.equal(result.status, "authenticated");
    const row = await harness.owned.client.sessionRow.findUnique({ where: { sessionId: "auth_test_service_session" } });
    assert.ok(row);
    const serialized = JSON.stringify(row).toLowerCase();
    for (const forbidden of ["password", "oauthtoken", "refreshtoken", "apikey", "authorization"]) assert.equal(serialized.includes(forbidden), false);
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("PostgreSQL schema contains no credential-bearing authentication columns", async () => {
  const harness = repositories();
  try {
    const rows = await harness.owned.client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'identities', 'sessions')
    `;
    const columns = rows.map((row) => row.column_name.toLowerCase());
    for (const forbidden of ["password", "password_hash", "oauth_token", "refresh_token", "youtube_credential", "openai_key"]) assert.equal(columns.includes(forbidden), false);
  } finally { await harness.owned.disconnect(); }
});

test("PostgreSQL provisions Google User and Identity atomically and resolves later login", async () => {
  const harness = repositories();
  await deleteOwnedPostgresTestRows(harness.owned);
  try {
    const provisioner = new PrismaExternalIdentityProvisioner(harness.owned.client);
    const input = { externalIdentity: { provider: "google" as const, providerSubject: "google_pg_subject", email: "google-pg@example.com", emailVerified: true as const, displayName: "Google PG" }, userId: "auth_test_google_user", identityId: "auth_test_google_identity", locale: "en" as const, createdAt: AUTH_TEST_TIME };
    const first = await provisioner.resolveOrProvision(input);
    const later = await provisioner.resolveOrProvision({ ...input, userId: "auth_test_unused_user", identityId: "auth_test_unused_identity" });
    assert.equal(first.status, "success");
    assert.equal(later.status, "success");
    if (first.status === "success" && later.status === "success") {
      assert.equal(first.provisioned, true);
      assert.equal(later.provisioned, false);
      assert.equal(later.identity.identityId, first.identity.identityId);
    }
  } finally { await deleteOwnedPostgresTestRows(harness.owned); await harness.owned.disconnect(); }
});

test("PostgreSQL never links a new Google subject by matching email alone", async () => {
  const harness = repositories();
  await deleteOwnedPostgresTestRows(harness.owned);
  try {
    await harness.users.create({ ...userInput, email: "existing@example.com" });
    const result = await new PrismaExternalIdentityProvisioner(harness.owned.client).resolveOrProvision({ externalIdentity: { provider: "google", providerSubject: "google_conflict", email: "existing@example.com", emailVerified: true }, userId: "auth_test_conflict_user", identityId: "auth_test_conflict_identity", locale: "es", createdAt: AUTH_TEST_TIME });
    assert.equal(result.status, "failure");
    if (result.status === "failure") assert.equal(result.error.code, "identity-conflict");
    assert.equal((await harness.users.getById("auth_test_conflict_user")).status, "failure");
  } finally { await deleteOwnedPostgresTestRows(harness.owned); await harness.owned.disconnect(); }
});

test("PostgreSQL resolves only hashed opaque session tokens and honors revocation", async () => {
  const harness = repositories();
  await deleteOwnedPostgresTestRows(harness.owned);
  try {
    await harness.users.create(userInput);
    const tokens = new SessionTokenService();
    const token = await tokens.generate();
    await harness.sessions.create({ ...sessionInput, tokenHash: token.tokenHash });
    assert.equal((await harness.sessions.getByTokenHash(token.tokenHash)).status, "success");
    const resolver = new CurrentSessionResolver(harness.sessions, harness.users, tokens, new AuthenticationTestClock([AUTH_TEST_LATER, AUTH_TEST_LATER]));
    const request = new Request("http://localhost", { headers: { cookie: `creatoros_session=${token.token}` } });
    assert.equal((await resolver.resolveCurrentSession(request)).status, "authenticated");
    await harness.sessions.revoke(sessionInput.sessionId, AUTH_TEST_LATER);
    assert.equal((await resolver.resolveCurrentSession(request)).status, "anonymous");
    const row = await harness.owned.client.sessionRow.findUnique({ where: { sessionId: sessionInput.sessionId } });
    assert.ok(row);
    assert.equal(JSON.stringify(row).includes(token.token), false);
  } finally { await deleteOwnedPostgresTestRows(harness.owned); await harness.owned.disconnect(); }
});

test("PostgreSQL concurrent Google provisioning creates no partial duplicate account", async () => {
  const harness = repositories();
  await deleteOwnedPostgresTestRows(harness.owned);
  try {
    const provisioner = new PrismaExternalIdentityProvisioner(harness.owned.client);
    const base = { externalIdentity: { provider: "google" as const, providerSubject: "google_race", email: "race@example.com", emailVerified: true as const }, locale: "es" as const, createdAt: AUTH_TEST_TIME };
    const results = await Promise.all([
      provisioner.resolveOrProvision({ ...base, userId: "auth_test_race_a", identityId: "auth_test_race_identity_a" }),
      provisioner.resolveOrProvision({ ...base, userId: "auth_test_race_b", identityId: "auth_test_race_identity_b" }),
    ]);
    assert.equal(results.filter((result) => result.status === "success").length, 2);
    assert.equal(results.filter((result) => result.status === "success" && result.provisioned).length, 1);
    assert.equal(await harness.owned.client.userRow.count({ where: { email: "race@example.com" } }), 1);
    assert.equal(await harness.owned.client.identityRow.count({ where: { provider: "google", providerSubject: "google_race" } }), 1);
  } finally { await deleteOwnedPostgresTestRows(harness.owned); await harness.owned.disconnect(); }
});
