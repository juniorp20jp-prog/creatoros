export const FIXTURE_CHANNEL_DATA_SCHEMA_VERSION = "1" as const;

export type FixtureCreatorSource = {
  creatorId: string;
  displayName?: string | null;
  locale?: string | null;
};

export type FixtureChannelSource = {
  channelId: string;
  ownerCreatorId: string;
  title?: string | null;
  createdAt?: string | null;
  language?: string | null;
  market?: string | null;
  subscriberCount: number;
  lifetimeViewCount?: number | null;
  publishedVideoCount?: number | null;
};

export type FixtureVideoSource = {
  videoId: string;
  publishedAt: string;
  viewCount: number;
  likeCount?: number | null;
  commentCount?: number | null;
  durationSeconds?: number | null;
};

export type FixtureChannelDataSource = {
  schemaVersion: typeof FIXTURE_CHANNEL_DATA_SCHEMA_VERSION;
  collectedAt: string;
  creator: FixtureCreatorSource;
  channel: FixtureChannelSource;
  videos: ReadonlyArray<FixtureVideoSource>;
};
