import assert from "node:assert/strict";
import test from "node:test";

import {
  PrismaUserRepository,
  PrismaYouTubeAnalyticsRepository,
  PrismaYouTubeAuthorizationRepository,
  createAnalysisRunPrismaClient,
  type OwnedAnalysisRunPrismaClient,
} from "../../persistence/prisma";
import type { YouTubeAnalyticsRepository } from "../../youtube-analytics";
import { YOUTUBE_ANALYTICS_READONLY_SCOPE } from "../../youtube-analytics";
import { YOUTUBE_READONLY_SCOPE } from "../../youtube-authorization";
import {
  ANALYTICS_CHANNEL,
  ANALYTICS_IDENTITY,
  ANALYTICS_USER,
  analyticsInput,
  runYouTubeAnalyticsRepositoryContract,
} from "../youtube-analytics-repository-conformance.test";
import { deleteOwnedPostgresTestRows, requireTestDatabaseUrl } from "./postgres-test-harness";

const owners = new WeakMap<object, OwnedAnalysisRunPrismaClient>();
const AT = "2026-09-12T10:00:00.000Z";

async function createRepository(): Promise<PrismaYouTubeAnalyticsRepository> {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  await deleteOwnedPostgresTestRows(owned);
  await new PrismaUserRepository(owned.client).create({
    userId: ANALYTICS_USER,
    email: "youtube-analytics@example.com",
    displayName: "Analytics",
    locale: "en",
    createdAt: AT,
  });
  await new PrismaYouTubeAuthorizationRepository(owned.client).saveAuthorization({
    identity: {
      youtubeIdentityId: ANALYTICS_IDENTITY,
      userId: ANALYTICS_USER,
      provider: "youtube",
      providerUserId: "provider_analytics_repository",
      channelId: ANALYTICS_CHANNEL,
      channelTitle: "Analytics Channel",
      scopes: [YOUTUBE_READONLY_SCOPE, YOUTUBE_ANALYTICS_READONLY_SCOPE],
      state: "connected",
      createdAt: AT,
      updatedAt: AT,
    },
    token: {
      tokenId: "youtube_token_analytics_repository",
      youtubeIdentityId: ANALYTICS_IDENTITY,
      encryptedRefreshToken: "yt1.test.iv.cipher.tag",
      encryptionKeyId: "test",
      createdAt: AT,
      updatedAt: AT,
    },
  });
  await owned.client.youTubeChannelRow.create({
    data: {
      channelId: ANALYTICS_CHANNEL,
      userId: ANALYTICS_USER,
      youtubeIdentityId: ANALYTICS_IDENTITY,
      title: "Analytics Channel",
      description: "",
      publishedAt: new Date("2020-01-01T00:00:00.000Z"),
      viewCount: "100",
      videoCount: "1",
      hiddenSubscriberCount: false,
      keywords: [],
      brandingSettings: { keywords: [] },
      privacyStatus: "public",
      lastSyncedAt: new Date(AT),
      syncStatus: "synced",
      createdAt: new Date(AT),
      updatedAt: new Date(AT),
    },
  });
  await owned.client.youTubeVideoRow.create({
    data: {
      videoId: "video_analytics_repository",
      userId: ANALYTICS_USER,
      channelId: ANALYTICS_CHANNEL,
      title: "Analytics Video",
      description: "",
      publishedAt: new Date("2026-09-01T00:00:00.000Z"),
      durationSeconds: 60,
      viewCount: "100",
      tags: [],
      availabilityStatus: "available",
      lastSeenAt: new Date(AT),
      lastSyncedAt: new Date(AT),
      createdAt: new Date(AT),
      updatedAt: new Date(AT),
    },
  });
  const repository = new PrismaYouTubeAnalyticsRepository(owned.client);
  owners.set(repository, owned);
  return repository;
}

async function cleanup(repository: YouTubeAnalyticsRepository): Promise<void> {
  const owned = owners.get(repository);
  if (!owned) return;
  await deleteOwnedPostgresTestRows(owned);
  await owned.disconnect();
}

runYouTubeAnalyticsRepositoryContract(
  "YouTube Analytics repository/PostgreSQL",
  createRepository,
  cleanup,
);

test("YouTube Analytics PostgreSQL persistence is atomic and contains no credential columns", async () => {
  const repository = await createRepository();
  const owned = owners.get(repository);
  assert.ok(owned);
  try {
    const input = analyticsInput(
      "analytics_batch_security",
      "2026-09-12T11:00:00.000Z",
      "99999999999999999999.125",
    );
    assert.equal((await repository.persist(input)).status, "success");
    const projection = await repository.getChannelProjection(
      ANALYTICS_USER,
      "30d",
      "2026-09-12T12:00:00.000Z",
    );
    if (projection.status === "success") {
      assert.equal(projection.value.values.views, "99999999999999999999.125");
    }
    const columns = await owned.client.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('youtube_analytics_capabilities','channel_daily_analytics_observations','video_daily_analytics_observations')`;
    const names = columns.map((row) => row.column_name.toLowerCase());
    for (const forbidden of [
      "access_token",
      "refresh_token",
      "authorization_code",
      "id_token",
      "raw_payload",
      "secret",
    ]) {
      assert.equal(names.includes(forbidden), false);
    }
    assert.equal(
      await owned.client.metricObservationBatchRow.count({
        where: { batchId: input.batch.batchId },
      }),
      1,
    );
  } finally {
    await cleanup(repository);
  }
});

test("YouTube Analytics PostgreSQL rolls back the batch when a nested metric is invalid", async () => {
  const repository = await createRepository();
  const owned = owners.get(repository);
  assert.ok(owned);
  try {
    const input = analyticsInput(
      "analytics_batch_rollback",
      "2026-09-12T11:00:00.000Z",
      "not-a-decimal",
    );
    const result = await repository.persist(input);
    assert.equal(result.status, "failure");
    assert.equal(
      await owned.client.metricObservationBatchRow.count({
        where: { batchId: input.batch.batchId },
      }),
      0,
    );
    assert.equal(
      await owned.client.channelDailyAnalyticsObservationRow.count({
        where: { batchId: input.batch.batchId },
      }),
      0,
    );
    assert.equal(
      await owned.client.videoDailyAnalyticsObservationRow.count({
        where: { batchId: input.batch.batchId },
      }),
      0,
    );
  } finally {
    await cleanup(repository);
  }
});
