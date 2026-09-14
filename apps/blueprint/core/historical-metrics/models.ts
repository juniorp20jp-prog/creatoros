export const HISTORICAL_METRICS_SCHEMA_VERSION = 1 as const;
export type MetricCollectionOutcome = "completed" | "no-change" | "partial" | "no-data" | "failed";
export type MetricObservationSource = "youtube-channel-sync" | "youtube-video-sync" | "youtube-analytics-query";
export type MetricObservationProvenance = "provider-sync" | "baseline-from-current-state" | "provider-analytics-query";
export type MetricAvailability = "available" | "partial" | "authorization-revoked" | "unavailable";
export type MetricObservationBatch = Readonly<{ batchId: string; userId: string; channelId: string; sourceSyncId: string; sourceType: MetricObservationSource; provider: "youtube"; observedAt: string; collectionOutcome: MetricCollectionOutcome; availability: MetricAvailability; coverageCount: number; coverageLimit?: number; truncated: boolean; schemaVersion: typeof HISTORICAL_METRICS_SCHEMA_VERSION; provenance: MetricObservationProvenance; createdAt: string; requestedStartDate?: string; requestedEndDate?: string; effectiveDataThrough?: string; availableFields?: ReadonlyArray<string>; missingFields?: ReadonlyArray<string> }>;
export type ChannelMetricObservation = Readonly<{ batchId: string; subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean; sourceEtag?: string; availableFields: ReadonlyArray<"subscriberCount" | "viewCount" | "videoCount" | "hiddenSubscriberCount"> }>;
export type VideoMetricObservation = Readonly<{ batchId: string; videoId: string; viewCount?: string; likeCount?: string; commentCount?: string; sourceEtag?: string; availabilityStatus: "available" | "private" | "deleted" | "unavailable" | "not-in-current-window"; availableFields: ReadonlyArray<"viewCount" | "likeCount" | "commentCount"> }>;
export type ChannelObservationRecord = Readonly<{ batch: MetricObservationBatch; observation: ChannelMetricObservation }>;
export type VideoObservationRecord = Readonly<{ batch: MetricObservationBatch; observation: VideoMetricObservation }>;
export type HistoricalCursor = Readonly<{ observedAt: string; batchId: string }>;
export type HistoricalPage<TItem> = Readonly<{ items: ReadonlyArray<TItem>; nextCursor?: HistoricalCursor }>;
export type HistoricalMetricName = "subscribers" | "views" | "video-count" | "video-views" | "video-likes" | "video-comments";
export type TrendUnavailableReason = "insufficient-history" | "unavailable-metric" | "unsafe-number" | "invalid-interval";
export type MetricTrend = Readonly<{ state: "unavailable"; metric: HistoricalMetricName; reason: TrendUnavailableReason; observationCount: number }> | Readonly<{ state: "available"; metric: HistoricalMetricName; earliestValue: string; latestValue: string; absoluteDelta: string; relativeDelta: number | null; velocityPerDay: number; accelerationPerDaySquared?: number; observationCount: number; startedAt: string; endedAt: string; partialCoverage: boolean }>;
export type DataFreshness = Readonly<{ state: "current" | "stale" | "unavailable"; latestObservedAt?: string; ageMilliseconds?: number; partialCoverage: boolean }>;
export type HistoricalRetentionReason = "authorization-revoked" | "user-disconnect" | "user-delete" | "policy-expiration";
export interface HistoricalMetricsRetentionPolicy { evaluate(input: Readonly<{ userId: string; reason: HistoricalRetentionReason; evaluatedAt: string }>): Readonly<{ action: "retain" | "delete"; reason: HistoricalRetentionReason }>; }
