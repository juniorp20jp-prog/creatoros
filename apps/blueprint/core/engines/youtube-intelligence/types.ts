import type { CreatorObjective } from "../../domain/creator";

export const YOUTUBE_INTELLIGENCE_ENGINE_ID =
  "youtube-intelligence" as const;

export type YouTubeIntelligenceEngineId =
  typeof YOUTUBE_INTELLIGENCE_ENGINE_ID;

export type YouTubeChannelInput = {
  id: string;
  name: string;
  createdAt?: string;
  subscribers: number;
  totalViews?: number;
  totalVideos?: number;
  languageOrMarket?: string;
};

export type YouTubeVideoInput = {
  id: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  views: number;
  likes?: number;
  comments?: number;
  impressions?: number;
  ctr?: number;
  averageViewDurationSeconds?: number;
  averagePercentageViewed?: number;
  subscribersGained?: number;
};

export type YouTubeAnalysisPeriod = {
  startDate: string;
  endDate: string;
};

export type YouTubeAnalysisContext = {
  analysisDate: string;
  market?: string;
  period: YouTubeAnalysisPeriod;
  creatorObjective?: CreatorObjective;
};

export type YouTubeIntelligenceInput = {
  channel: YouTubeChannelInput;
  videos: ReadonlyArray<YouTubeVideoInput>;
  context: YouTubeAnalysisContext;
};

export type RelativePerformanceClassification =
  | "below-median"
  | "near-median"
  | "above-median"
  | "exceptional";

export type YouTubeMetricName =
  | "views"
  | "durationSeconds"
  | "likes"
  | "comments"
  | "impressions"
  | "ctr"
  | "averageViewDurationSeconds"
  | "averagePercentageViewed"
  | "subscribersGained";

export type VideoEngagement = {
  rate: number;
  interactions: number;
  includedMetrics: ReadonlyArray<"likes" | "comments">;
  partial: boolean;
};

export type YouTubeVideoPerformance = {
  videoId: string;
  title: string;
  publishedAt: string;
  availableMetrics: ReadonlyArray<YouTubeMetricName>;
  metrics: {
    views: number;
    durationSeconds: number;
    likes?: number;
    comments?: number;
    impressions?: number;
    ctr?: number;
    averageViewDurationSeconds?: number;
    averagePercentageViewed?: number;
    subscribersGained?: number;
  };
  derivedMetrics: {
    engagement?: VideoEngagement;
    subscribersGainedPerThousandViews?: number;
  };
  comparison: {
    channelAverageViews: number;
    channelMedianViews: number;
    viewsDifferenceFromMedian: number;
    viewsToAverageRatio?: number;
    viewsToMedianRatio?: number;
  };
  classification: RelativePerformanceClassification;
};

export type PublicationFrequencySummary = {
  intervalCount: number;
  intervalsDays: ReadonlyArray<number>;
  averageIntervalDays?: number;
  medianIntervalDays?: number;
  coefficientOfVariation?: number;
  videosPer30Days?: number;
};

export type ChannelEngagementSummary = {
  rate?: number;
  interactions: number;
  eligibleViews: number;
  eligibleVideoCount: number;
  partiallyMeasuredVideoCount: number;
};

export type SubscriberImpactSummary = {
  totalSubscribersGained?: number;
  averageSubscribersGainedPerEligibleVideo?: number;
  subscribersGainedPerThousandViews?: number;
  eligibleVideoCount: number;
};

export type ViewConcentrationSummary = {
  topVideoShare?: number;
  topThreeShare?: number;
  videosIncludedInTopThree: number;
  limitedSample: boolean;
};

export type YouTubeChannelSummary = {
  channel: YouTubeChannelInput;
  requestedPeriod: YouTubeAnalysisPeriod;
  coveredPeriod?: YouTubeAnalysisPeriod;
  analyzedVideoCount: number;
  totalViews: number;
  averageViews: number;
  medianViews: number;
  averageVideoDurationSeconds: number;
  publicationFrequency: PublicationFrequencySummary;
  engagement: ChannelEngagementSummary;
  subscriberImpact: SubscriberImpactSummary;
  historicalChannelGrowth: {
    status: "not-calculable";
    reason: "subscriber-history-not-provided";
  };
  viewConcentration: ViewConcentrationSummary;
};

export type YouTubeSignalCode =
  | "publication-inconsistency"
  | "view-concentration"
  | "above-median-performance"
  | "relative-high-ctr"
  | "relative-low-ctr"
  | "relative-high-retention"
  | "relative-low-retention"
  | "relative-high-engagement"
  | "relative-low-engagement"
  | "publication-frequency-change"
  | "duration-performance-association"
  | "recurring-title-terms";

export type YouTubeSignalConfidence = "low" | "medium" | "high";
export type YouTubeSignalImpact = "low" | "medium" | "high";

export type YouTubeIntelligenceSignal = {
  code: YouTubeSignalCode;
  impact: YouTubeSignalImpact;
  confidence: YouTubeSignalConfidence;
  evidence: Readonly<Record<string, number>>;
  relatedVideoIds: ReadonlyArray<string>;
  relatedTerms?: ReadonlyArray<string>;
  explanation: {
    code: string;
    parameters: Readonly<Record<string, string | number>>;
  };
};

export type ExcludedVideo = {
  videoId: string;
  reason: "outside-requested-period";
};

export type DataQualityWarning = {
  code: string;
  message: string;
  videoIds: ReadonlyArray<string>;
};

export type UnevaluatedSignal = {
  code: YouTubeSignalCode;
  reason:
    | "insufficient-sample"
    | "metric-unavailable"
    | "insufficient-variation"
    | "no-qualifying-evidence";
  requiredVideos: number;
  availableVideos: number;
};

export type YouTubeDataQuality = {
  fields: {
    completelyAvailable: ReadonlyArray<string>;
    partiallyAvailable: ReadonlyArray<string>;
    absent: ReadonlyArray<string>;
  };
  inputVideoCount: number;
  effectiveVideoCount: number;
  excludedVideos: ReadonlyArray<ExcludedVideo>;
  warnings: ReadonlyArray<DataQualityWarning>;
  limitations: ReadonlyArray<string>;
  unevaluatedSignals: ReadonlyArray<UnevaluatedSignal>;
};

export type YouTubeIntelligenceOutput = {
  context: YouTubeAnalysisContext;
  summary: YouTubeChannelSummary;
  videos: ReadonlyArray<YouTubeVideoPerformance>;
  signals: ReadonlyArray<YouTubeIntelligenceSignal>;
  dataQuality: YouTubeDataQuality;
};

export type YouTubeValidationIssue = {
  field: string;
  code: string;
  message: string;
};
