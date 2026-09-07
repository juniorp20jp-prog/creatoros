import assert from "node:assert/strict";
import { test } from "node:test";

import type { VideoSynchronizationRepository } from "../../youtube-video-sync";
import {
  createAnalysisRunPrismaClient,
  PrismaChannelSynchronizationRepository,
  PrismaUserRepository,
  PrismaVideoSynchronizationRepository,
  PrismaYouTubeAuthorizationRepository,
  type OwnedAnalysisRunPrismaClient,
} from "../../persistence/prisma";
import { channelFixture, synchronizationFixture } from "../youtube-channel-repository-conformance.test";
import {
  runVideoSynchronizationRepositoryContract,
  videoFixture,
  videoSyncFixture,
} from "../youtube-video-repository-conformance.test";
import { YOUTUBE_READONLY_SCOPE } from "../../youtube-authorization";
import {
  deleteOwnedPostgresTestRows,
  requireTestDatabaseUrl,
} from "./postgres-test-harness";

const owners = new WeakMap<object, OwnedAnalysisRunPrismaClient>();

async function createRepository(): Promise<PrismaVideoSynchronizationRepository> {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  await deleteOwnedPostgresTestRows(owned);
  await new PrismaUserRepository(owned.client).create({
    userId: videoFixture.userId,
    email: "video-sync@example.com",
    displayName: "Video Sync",
    locale: "en",
    createdAt: videoFixture.createdAt,
  });
  await new PrismaYouTubeAuthorizationRepository(owned.client).saveAuthorization({
    identity: {
      youtubeIdentityId: videoSyncFixture.youtubeIdentityId,
      userId: videoFixture.userId,
      provider: "youtube",
      providerUserId: "provider_video_sync",
      channelId: videoFixture.channelId,
      channelTitle: channelFixture.title,
      scopes: [YOUTUBE_READONLY_SCOPE],
      state: "connected",
      createdAt: videoFixture.createdAt,
      updatedAt: videoFixture.updatedAt,
    },
    token: {
      tokenId: "youtube_token_video_sync",
      youtubeIdentityId: videoSyncFixture.youtubeIdentityId,
      encryptedRefreshToken: "yt1.test.iv.cipher.tag",
      encryptionKeyId: "test",
      createdAt: videoFixture.createdAt,
      updatedAt: videoFixture.updatedAt,
    },
  });
  const channelRepository = new PrismaChannelSynchronizationRepository(owned.client);
  await channelRepository.complete({
    channel: {
      ...channelFixture,
      userId: videoFixture.userId,
      youtubeIdentityId: videoSyncFixture.youtubeIdentityId,
    },
    synchronization: {
      ...synchronizationFixture,
      userId: videoFixture.userId,
      youtubeIdentityId: videoSyncFixture.youtubeIdentityId,
    },
  });
  const repository = new PrismaVideoSynchronizationRepository(owned.client);
  owners.set(repository, owned);
  return repository;
}

runVideoSynchronizationRepositoryContract(
  "Video synchronization repository/PostgreSQL",
  createRepository,
  async (repository: VideoSynchronizationRepository) => {
    const owned = owners.get(repository);
    if (!owned) return;
    await deleteOwnedPostgresTestRows(owned);
    await owned.disconnect();
  },
);

test("PostgreSQL transaction rolls back video creation when audit is invalid", async () => {
  const repository = await createRepository();
  const owned = owners.get(repository);
  assert.ok(owned);
  try {
    const result = await repository.complete({
      created: [{ ...videoFixture, videoId: "video_rollback" }],
      updated: [],
      synchronization: {
        ...videoSyncFixture,
        syncId: "youtube_video_sync_rollback",
        youtubeIdentityId: "missing_identity",
      },
    });
    assert.equal(result.status, "failure");
    const stored = await repository.getByIds(videoFixture.userId, [
      "video_rollback",
    ]);
    if (stored.status === "success") assert.equal(stored.value.length, 0);
  } finally {
    await deleteOwnedPostgresTestRows(owned);
    await owned.disconnect();
  }
});

test("PostgreSQL video tables contain no credential or raw payload columns", async () => {
  const repository = await createRepository();
  const owned = owners.get(repository);
  assert.ok(owned);
  try {
    const columns = await owned.client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('youtube_videos', 'youtube_video_syncs')
    `;
    const names = columns.map((row) => row.column_name.toLowerCase());
    for (const forbidden of [
      "access_token",
      "refresh_token",
      "authorization_code",
      "id_token",
      "authorization_header",
      "page_token",
      "raw_payload",
      "secret",
    ]) {
      assert.equal(names.includes(forbidden), false);
    }
  } finally {
    await deleteOwnedPostgresTestRows(owned);
    await owned.disconnect();
  }
});
