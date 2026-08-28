export type YouTubeChannelPrivacyStatus = "public" | "unlisted" | "private";
export type ChannelSyncOutcome = "completed" | "no-change" | "failed";

export type YouTubeBrandingSettings = Readonly<{
  title?: string;
  description?: string;
  defaultLanguage?: string;
  country?: string;
  keywords: ReadonlyArray<string>;
  bannerUrl?: string;
}>;

export type YouTubeChannelSnapshot = Readonly<{
  channelId: string;
  title: string;
  handle?: string;
  description: string;
  publishedAt: string;
  country?: string;
  customUrl?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  subscriberCount?: string;
  viewCount: string;
  videoCount: string;
  hiddenSubscriberCount: boolean;
  defaultLanguage?: string;
  keywords: ReadonlyArray<string>;
  brandingSettings: YouTubeBrandingSettings;
  privacyStatus: YouTubeChannelPrivacyStatus;
  sourceEtag?: string;
}>;

export type YouTubeChannel = YouTubeChannelSnapshot & Readonly<{
  userId: string;
  youtubeIdentityId: string;
  lastSyncedAt: string;
  syncStatus: "synced";
  createdAt: string;
  updatedAt: string;
}>;

export type ChannelSynchronization = Readonly<{
  syncId: string;
  userId: string;
  youtubeIdentityId: string;
  channelId?: string;
  outcome: ChannelSyncOutcome;
  changedFields: ReadonlyArray<string>;
  failureCode?: string;
  startedAt: string;
  completedAt: string;
}>;

export type ChannelSynchronizationStatus = Readonly<{
  channelConnected: boolean;
  lastSync: ChannelSynchronization | null;
}>;
