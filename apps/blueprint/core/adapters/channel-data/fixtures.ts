import { FIXTURE_CHANNEL_DATA_SCHEMA_VERSION } from "./fixture-source";

const complete = {
  schemaVersion: FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  collectedAt: "2026-07-20T12:00:00.000Z",
  creator: {
    creatorId: "creator_fixture_complete",
    displayName: "Fixture Creator",
    locale: "es",
  },
  channel: {
    channelId: "channel_fixture_complete",
    ownerCreatorId: "creator_fixture_complete",
    title: "Fixture Channel",
    createdAt: "2024-01-01T00:00:00.000Z",
    language: "es",
    market: "US",
    subscriberCount: 1_000,
    lifetimeViewCount: 20_000,
    publishedVideoCount: 40,
  },
  videos: [
    {
      videoId: "fixture_video_1",
      publishedAt: "2026-07-01T12:00:00.000Z",
      viewCount: 200,
      likeCount: 10,
      commentCount: 2,
      durationSeconds: 600,
    },
    {
      videoId: "fixture_video_2",
      publishedAt: "2026-07-08T12:00:00.000Z",
      viewCount: 300,
      likeCount: 15,
      commentCount: 3,
      durationSeconds: 720,
    },
    {
      videoId: "fixture_video_3",
      publishedAt: "2026-07-15T12:00:00.000Z",
      viewCount: 400,
      likeCount: 20,
      commentCount: 4,
      durationSeconds: 840,
    },
  ],
} as const;

const partial = {
  schemaVersion: FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  collectedAt: "2026-07-20T12:00:00.000Z",
  creator: {
    creatorId: "creator_fixture_partial",
  },
  channel: {
    channelId: "channel_fixture_partial",
    ownerCreatorId: "creator_fixture_partial",
    subscriberCount: 250,
  },
  videos: [
    {
      videoId: "fixture_partial_video",
      publishedAt: "2026-07-10T12:00:00.000Z",
      viewCount: 75,
    },
  ],
} as const;

const noVideos = {
  schemaVersion: FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  collectedAt: "2026-07-20T12:00:00.000Z",
  creator: {
    creatorId: "creator_fixture_empty",
    displayName: "Empty Fixture Creator",
    locale: "en",
  },
  channel: {
    channelId: "channel_fixture_empty",
    ownerCreatorId: "creator_fixture_empty",
    title: "Empty Fixture Channel",
    createdAt: "2025-01-01T00:00:00.000Z",
    language: "en",
    market: "US",
    subscriberCount: 0,
    lifetimeViewCount: 0,
    publishedVideoCount: 0,
  },
  videos: [],
} as const;

const invalidMetrics = {
  schemaVersion: FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  collectedAt: "2026-07-20T12:00:00.000Z",
  creator: {
    creatorId: "creator_fixture_invalid",
    displayName: "Invalid Fixture Creator",
    locale: "en",
  },
  channel: {
    channelId: "channel_fixture_invalid",
    ownerCreatorId: "creator_fixture_invalid",
    title: "Invalid Fixture Channel",
    createdAt: "2025-01-01T00:00:00.000Z",
    language: "en",
    market: "US",
    subscriberCount: -1,
    lifetimeViewCount: 10,
    publishedVideoCount: 1,
  },
  videos: [],
} as const;

const unknownFields = {
  ...complete,
  sourceDebugLabel: "must-not-cross-adapter-boundary",
  creator: {
    ...complete.creator,
    sourceInternalCreatorCode: "ignored",
  },
  channel: {
    ...complete.channel,
    providerRanking: 99,
  },
  videos: [
    {
      ...complete.videos[0],
      privateSourceNote: "ignored",
    },
  ],
} as const;

export const fixtureChannelData = {
  complete,
  partial,
  noVideos,
  invalidMetrics,
  unknownFields,
} as const;

export type FixtureChannelDataId =
  keyof typeof fixtureChannelData;
