import type {
  ChannelDailyAnalyticsObservation,
  VideoAnalyticsProjection,
  VideoDailyAnalyticsObservation,
  YouTubeAnalyticsBatch,
  YouTubeAnalyticsCapability,
  YouTubeAnalyticsPeriod,
  YouTubeAnalyticsProjection,
} from "./models";

export type YouTubeAnalyticsRepositoryErrorCode =
  | "invalid-input"
  | "not-found"
  | "duplicate"
  | "persistence-failure";
export type YouTubeAnalyticsRepositoryResult<T> =
  | Readonly<{ status: "success"; value: T }>
  | Readonly<{ status: "failure"; error: Readonly<{ code: YouTubeAnalyticsRepositoryErrorCode; message: string }> }>;

export interface YouTubeAnalyticsRepository {
  getCapability(userId: string): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsCapability>>;
  saveCapability(capability: YouTubeAnalyticsCapability): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsCapability>>;
  persist(input: Readonly<{ batch: YouTubeAnalyticsBatch; channel: ReadonlyArray<ChannelDailyAnalyticsObservation>; videos: ReadonlyArray<VideoDailyAnalyticsObservation> }>): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsBatch>>;
  getChannelProjection(userId: string, period: YouTubeAnalyticsPeriod, asOf: string): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsProjection>>;
  getVideoProjection(userId: string, period: YouTubeAnalyticsPeriod, asOf: string): Promise<YouTubeAnalyticsRepositoryResult<ReadonlyArray<VideoAnalyticsProjection>>>;
}
