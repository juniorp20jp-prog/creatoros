import assert from "node:assert/strict";
import { test } from "node:test";

import { AuthenticationService } from "../../authentication";
import { PrismaIdentityRepository, PrismaSessionRepository, PrismaUserRepository, createAnalysisRunPrismaClient } from "../../persistence/prisma";
import { SessionService } from "../../session";
import { runAuthenticationRepositoryContractTests } from "../fixtures/authentication-repository-contract";
import { AUTH_TEST_EXPIRY, AUTH_TEST_TIME, AuthenticationTestClock, identityInput, sessionInput, userInput } from "../fixtures/authentication-fixtures";
import { deleteOwnedPostgresTestRows, requireTestDatabaseUrl } from "./postgres-test-harness";

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
    const result = await service.authenticateIdentity({ identityId: identityInput.identityId, sessionId: "auth_test_service_session", expiresAt: AUTH_TEST_EXPIRY, metadata: { clientType: "internal" } });
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
