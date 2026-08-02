import assert from "node:assert/strict";
import { test } from "node:test";

import type { OwnedAnalysisRunPrismaClient } from "../../persistence/prisma";
import { createAnalysisRunPrismaClient, PrismaUserRepository, PrismaYouTubeAuthorizationRepository } from "../../persistence/prisma";
import type { YouTubeAuthorizationRepository } from "../../youtube-authorization";
import { runYouTubeAuthorizationRepositoryContract, youtubeAuthorizationInput } from "../youtube-authorization-repository-conformance.test";
import { deleteOwnedPostgresTestRows, requireTestDatabaseUrl } from "./postgres-test-harness";

const owners = new WeakMap<object, OwnedAnalysisRunPrismaClient>();

runYouTubeAuthorizationRepositoryContract("YouTube authorization repository/PostgreSQL", async () => {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  await deleteOwnedPostgresTestRows(owned);
  const users = new PrismaUserRepository(owned.client);
  await users.create({ userId: youtubeAuthorizationInput.identity.userId, email: "youtube-repository@example.com", displayName: "YouTube Repository", locale: "en", createdAt: youtubeAuthorizationInput.identity.createdAt });
  const repository = new PrismaYouTubeAuthorizationRepository(owned.client);
  owners.set(repository, owned);
  return repository;
}, async (repository: YouTubeAuthorizationRepository) => {
  const owned = owners.get(repository);
  if (!owned) return;
  await deleteOwnedPostgresTestRows(owned);
  await owned.disconnect();
});

test("PostgreSQL stores encrypted envelopes and never plaintext provider tokens", async () => {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  await deleteOwnedPostgresTestRows(owned);
  try {
    await new PrismaUserRepository(owned.client).create({ userId: youtubeAuthorizationInput.identity.userId, email: "youtube-storage@example.com", displayName: "YouTube Storage", locale: "es", createdAt: youtubeAuthorizationInput.identity.createdAt });
    const repository = new PrismaYouTubeAuthorizationRepository(owned.client);
    assert.equal((await repository.saveAuthorization(youtubeAuthorizationInput)).status, "success");
    const row = await owned.client.youTubeTokenRow.findUnique({ where: { youtubeIdentityId: youtubeAuthorizationInput.identity.youtubeIdentityId } });
    assert.ok(row);
    assert.match(row.encryptedRefreshToken, /^yt1\./u);
    const serialized = JSON.stringify(row);
    assert.equal(serialized.includes("authorization-code"), false);
    assert.equal(serialized.includes("id-token"), false);
  } finally { await deleteOwnedPostgresTestRows(owned); await owned.disconnect(); }
});

test("PostgreSQL rejects one channel owned by two CreatorOS users without partial tokens", async () => {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  await deleteOwnedPostgresTestRows(owned);
  try {
    const users = new PrismaUserRepository(owned.client);
    await users.create({ userId: youtubeAuthorizationInput.identity.userId, email: "youtube-owner@example.com", displayName: "Owner", locale: "en", createdAt: youtubeAuthorizationInput.identity.createdAt });
    await users.create({ userId: "auth_test_youtube_other", email: "youtube-other@example.com", displayName: "Other", locale: "en", createdAt: youtubeAuthorizationInput.identity.createdAt });
    const repository = new PrismaYouTubeAuthorizationRepository(owned.client);
    await repository.saveAuthorization(youtubeAuthorizationInput);
    const duplicate = await repository.saveAuthorization({ identity: { ...youtubeAuthorizationInput.identity, youtubeIdentityId: "youtube_identity_other", userId: "auth_test_youtube_other", providerUserId: "provider_other" }, token: { ...youtubeAuthorizationInput.token, tokenId: "youtube_token_other", youtubeIdentityId: "youtube_identity_other" } });
    assert.equal(duplicate.status, "failure");
    if (duplicate.status === "failure") assert.equal(duplicate.error.code, "duplicate-channel");
    assert.equal(await owned.client.youTubeTokenRow.count(), 1);
  } finally { await deleteOwnedPostgresTestRows(owned); await owned.disconnect(); }
});
