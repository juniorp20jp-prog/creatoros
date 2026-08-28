import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChannelSynchronizationRepository } from "../../youtube-channel-sync";
import type { OwnedAnalysisRunPrismaClient } from "../../persistence/prisma";
import { createAnalysisRunPrismaClient, PrismaChannelSynchronizationRepository, PrismaUserRepository, PrismaYouTubeAuthorizationRepository } from "../../persistence/prisma";
import { channelFixture, runChannelSynchronizationRepositoryContract } from "../youtube-channel-repository-conformance.test";
import { YOUTUBE_READONLY_SCOPE } from "../../youtube-authorization";
import { deleteOwnedPostgresTestRows, requireTestDatabaseUrl } from "./postgres-test-harness";

const owners = new WeakMap<object, OwnedAnalysisRunPrismaClient>();

async function createRepository(): Promise<PrismaChannelSynchronizationRepository> {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  await deleteOwnedPostgresTestRows(owned);
  await new PrismaUserRepository(owned.client).create({ userId: channelFixture.userId, email: "channel-sync@example.com", displayName: "Channel Sync", locale: "en", createdAt: channelFixture.createdAt });
  await new PrismaYouTubeAuthorizationRepository(owned.client).saveAuthorization({ identity: { youtubeIdentityId: channelFixture.youtubeIdentityId, userId: channelFixture.userId, provider: "youtube", providerUserId: "provider_channel_sync", channelId: channelFixture.channelId, channelTitle: channelFixture.title, scopes: [YOUTUBE_READONLY_SCOPE], state: "connected", createdAt: channelFixture.createdAt, updatedAt: channelFixture.updatedAt }, token: { tokenId: "youtube_token_channel_sync", youtubeIdentityId: channelFixture.youtubeIdentityId, encryptedRefreshToken: "yt1.test.iv.cipher.tag", encryptionKeyId: "test", createdAt: channelFixture.createdAt, updatedAt: channelFixture.updatedAt } });
  const repository = new PrismaChannelSynchronizationRepository(owned.client);
  owners.set(repository, owned);
  return repository;
}

runChannelSynchronizationRepositoryContract("Channel synchronization repository/PostgreSQL", createRepository, async (repository: ChannelSynchronizationRepository) => { const owned = owners.get(repository); if (!owned) return; await deleteOwnedPostgresTestRows(owned); await owned.disconnect(); });

test("PostgreSQL preserves unsigned-long counts without JavaScript precision loss", async () => {
  const repository = await createRepository();
  const owned = owners.get(repository);
  assert.ok(owned);
  try {
    const huge = { ...channelFixture, viewCount: "18446744073709551615", videoCount: "9007199254740993" };
    const result = await repository.complete({ channel: huge, synchronization: { syncId: "youtube_sync_bigint", userId: huge.userId, youtubeIdentityId: huge.youtubeIdentityId, channelId: huge.channelId, outcome: "completed", changedFields: ["viewCount", "videoCount"], startedAt: huge.updatedAt, completedAt: huge.updatedAt } });
    assert.equal(result.status, "success");
    const stored = await repository.getByUserId(huge.userId);
    if (stored.status === "success") { assert.equal(stored.value.viewCount, huge.viewCount); assert.equal(stored.value.videoCount, huge.videoCount); }
  } finally { await deleteOwnedPostgresTestRows(owned); await owned.disconnect(); }
});

test("PostgreSQL stores only normalized channel data and safe sync failures", async () => {
  const repository = await createRepository();
  const owned = owners.get(repository);
  assert.ok(owned);
  try {
    await repository.complete({ channel: channelFixture, synchronization: { syncId: "youtube_sync_safe", userId: channelFixture.userId, youtubeIdentityId: channelFixture.youtubeIdentityId, channelId: channelFixture.channelId, outcome: "completed", changedFields: ["title"], startedAt: channelFixture.updatedAt, completedAt: channelFixture.updatedAt } });
    const rows = await owned.client.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('youtube_channels', 'channel_syncs')`;
    const columns = rows.map((row) => row.column_name.toLowerCase());
    for (const forbidden of ["access_token", "refresh_token", "authorization_code", "id_token", "claims", "secret"]) assert.equal(columns.includes(forbidden), false);
  } finally { await deleteOwnedPostgresTestRows(owned); await owned.disconnect(); }
});
