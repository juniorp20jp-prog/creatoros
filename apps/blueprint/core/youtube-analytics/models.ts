export const YOUTUBE_ANALYTICS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/yt-analytics.readonly" as const;

export type YouTubeAnalyticsCapabilityState =
  | "not-authorized"
  | "authorized"
  | "declined"
  | "revoked"
  | "temporarily-unavailable";

export type YouTubeAnalyticsCapability = Readonly<{
  userId: string;
  state: YouTubeAnalyticsCapabilityState;
  authorizedAt?: string;
  lastCollectionAt?: string;
  effectiveDataThrough?: string;
  updatedAt: string;
}>;

export type YouTubeAnalyticsPeriod = "7d" | "30d" | "90d";
export type YouTubeAnalyticsMetric =
  | "views"
  | "estimatedMinutesWatched"
  | "averageViewDuration"
  | "averageViewPercentage"
  | "subscribersGained"
  | "subscribersLost"
  | "likes"
  | "comments"
  | "shares";

export type YouTubeAnalyticsValues = Readonly<
  Partial<Record<YouTubeAnalyticsMetric, string>>
>;

export type ChannelDailyAnalyticsObservation = Readonly<{
  batchId: string;
  metricDate: string;
  values: YouTubeAnalyticsValues;
  availableFields: ReadonlyArray<YouTubeAnalyticsMetric>;
}>;

export type VideoDailyAnalyticsObservation = Readonly<{
  batchId: string;
  videoId: string;
  metricDate: string;
  values: YouTubeAnalyticsValues;
  availableFields: ReadonlyArray<YouTubeAnalyticsMetric>;
}>;

export type YouTubeAnalyticsCollectionOutcome =
  | "completed"
  | "partial"
  | "no-data"
  | "failed";

export type YouTubeAnalyticsBatch = Readonly<{
  batchId: string;
  userId: string;
  channelId: string;
  requestedStartDate: string;
  requestedEndDate: string;
  effectiveDataThrough?: string;
  collectedAt: string;
  outcome: YouTubeAnalyticsCollectionOutcome;
  availableFields: ReadonlyArray<YouTubeAnalyticsMetric>;
  missingFields: ReadonlyArray<YouTubeAnalyticsMetric>;
  channelRowCount: number;
  videoRowCount: number;
  videoCoverageCount: number;
  videoCoverageLimit: number;
}>;

export type YouTubeAnalyticsProjection = Readonly<{
  period: YouTubeAnalyticsPeriod;
  requestedStartDate: string;
  requestedEndDate: string;
  effectiveDataThrough?: string;
  availability: "available" | "partial" | "no-data";
  freshness: "current" | "processing" | "unavailable";
  values: YouTubeAnalyticsValues & Readonly<{ netSubscribers?: string }>;
  availableFields: ReadonlyArray<YouTubeAnalyticsMetric | "netSubscribers">;
  missingFields: ReadonlyArray<YouTubeAnalyticsMetric>;
  channelDays: number;
  videoCount: number;
}>;

export type VideoAnalyticsProjection = Readonly<{
  videoId: string;
  values: YouTubeAnalyticsValues & Readonly<{ netSubscribers?: string }>;
  availableFields: ReadonlyArray<YouTubeAnalyticsMetric | "netSubscribers">;
  observedDays: number;
}>;

export const YOUTUBE_ANALYTICS_METRICS: ReadonlyArray<YouTubeAnalyticsMetric> = [
  "views",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "subscribersGained",
  "subscribersLost",
  "likes",
  "comments",
  "shares",
];
