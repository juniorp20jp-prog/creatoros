export const YOUTUBE_VIDEO_SYNC_COVERAGE_LIMIT = 50;

export type YouTubeVideoPrivacyStatus = "public" | "unlisted" | "private";
export type YouTubeVideoAvailabilityStatus =
  | "available"
  | "private"
  | "deleted"
  | "unavailable";
export type VideoSyncOutcome = "completed" | "no-change" | "partial" | "failed";

export type YouTubeVideoSnapshot = Readonly<{
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  privacyStatus?: YouTubeVideoPrivacyStatus;
  tags?: ReadonlyArray<string>;
  categoryId?: string;
  defaultLanguage?: string;
  sourceEtag?: string;
  availabilityStatus: YouTubeVideoAvailabilityStatus;
}>;

export type YouTubeVideo = YouTubeVideoSnapshot & Readonly<{
  userId: string;
  lastSeenAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type VideoSyncCounts = Readonly<{
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
  unavailable: number;
}>;

export type VideoSynchronization = Readonly<{
  syncId: string;
  userId: string;
  youtubeIdentityId: string;
  channelId: string;
  outcome: VideoSyncOutcome;
  counts: VideoSyncCounts;
  coverageCount: number;
  coverageLimit: number;
  truncated: boolean;
  failureCode?: string;
  startedAt: string;
  completedAt: string;
}>;

export type YouTubeVideoPage = Readonly<{
  videos: ReadonlyArray<YouTubeVideo>;
  nextCursor?: Readonly<{ publishedAt: string; videoId: string }>;
}>;

export type VideoSynchronizationStatus = Readonly<{
  videoCount: number;
  lastSync: VideoSynchronization | null;
}>;
