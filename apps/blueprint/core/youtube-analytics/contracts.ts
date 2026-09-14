import type {
  ChannelDailyAnalyticsObservation,
  VideoDailyAnalyticsObservation,
  YouTubeAnalyticsMetric,
} from "./models";

export type YouTubeAnalyticsProviderRequest = Readonly<{
  accessToken: string;
  channelId: string;
  videoIds: ReadonlyArray<string>;
  startDate: string;
  endDate: string;
  collectedAt: string;
}>;

export type YouTubeAnalyticsProviderResult =
  | Readonly<{
      status: "success";
      value: Readonly<{
        channel: ReadonlyArray<Omit<ChannelDailyAnalyticsObservation, "batchId">>;
        videos: ReadonlyArray<Omit<VideoDailyAnalyticsObservation, "batchId">>;
        availableFields: ReadonlyArray<YouTubeAnalyticsMetric>;
        missingFields: ReadonlyArray<YouTubeAnalyticsMetric>;
        effectiveDataThrough?: string;
        partial: boolean;
      }>;
    }>
  | Readonly<{
      status: "failure";
      error: Readonly<{
        code: "authorization" | "quota" | "unavailable" | "invalid-response";
        message: string;
      }>;
    }>;

export interface YouTubeAnalyticsAdapter {
  collect(input: YouTubeAnalyticsProviderRequest): Promise<YouTubeAnalyticsProviderResult>;
}
