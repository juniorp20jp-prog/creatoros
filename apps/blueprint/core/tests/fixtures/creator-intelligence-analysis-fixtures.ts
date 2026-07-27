import type {
  AnalysisResult,
  ChannelMetrics,
  RawChannelData,
} from "../../engines/creator-intelligence";

export const completeRawChannelData: RawChannelData = {
  collectedAt: "2026-07-20T12:00:00.000Z",
  creator: {
    id: "creator_test",
    displayName: "Test Creator",
    locale: "es",
  },
  channel: {
    id: "channel_test",
    creatorId: "creator_test",
    name: "Test Channel",
    createdAt: "2024-01-01T00:00:00.000Z",
    language: "es",
    market: "US",
    subscribers: 1_000,
    totalViews: 20_000,
    totalVideos: 40,
  },
  videos: [
    {
      id: "video_1",
      publishedAt: "2026-07-01T12:00:00.000Z",
      views: 200,
      likes: 10,
      comments: 2,
      durationSeconds: 600,
    },
    {
      id: "video_2",
      publishedAt: "2026-07-08T12:00:00.000Z",
      views: 300,
      likes: 15,
      comments: 3,
      durationSeconds: 720,
    },
    {
      id: "video_3",
      publishedAt: "2026-07-15T12:00:00.000Z",
      views: 400,
      likes: 20,
      comments: 4,
      durationSeconds: 840,
    },
  ],
};

export const completeChannelMetrics: ChannelMetrics = {
  channelId: "channel_test",
  capturedAt: "2026-07-20T12:00:00.000Z",
  subscriberCount: 1_000,
  reportedTotalViews: 20_000,
  reportedVideoCount: 40,
  videos: [],
  analyzedVideoCount: 3,
  analyzedViews: 900,
  averageViewsPerVideo: 300,
  averageEngagementRate: 6,
  averagePublishingIntervalDays: 7,
  publishingIntervalVariation: 0,
  subscriberReachRate: 30,
  dataCompleteness: 1,
};

export function createAnalysisResult(
  overrides: Partial<AnalysisResult> = {},
): AnalysisResult {
  return {
    analysisId: "analysis_test",
    analyzedAt: "2026-07-20T13:00:00.000Z",
    creator: {
      id: "creator_test",
    },
    channel: {
      id: "channel_test",
      creatorId: "creator_test",
    },
    metrics: completeChannelMetrics,
    scores: [],
    opportunities: [],
    recommendations: [],
    limitations: [],
    ...overrides,
  };
}
