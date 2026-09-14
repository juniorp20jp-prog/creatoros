import type { StrategicAnalysisProjection } from "../../intelligence/strategic-projection";

export type CreatorProfile = {
  id: string;
  displayName?: string;
  locale?: string;
};

export type ChannelProfile = {
  id: string;
  creatorId: string;
  name?: string;
  createdAt?: string;
  language?: string;
  market?: string;
};

export type VideoMetrics = {
  videoId: string;
  title?: string;
  publishedAt: string;
  views: number;
  likes?: number;
  comments?: number;
  durationSeconds?: number;
};

export type ChannelMetrics = {
  channelId: string;
  capturedAt: string;
  subscriberCount: number;
  reportedTotalViews?: number;
  reportedVideoCount?: number;
  videos: ReadonlyArray<VideoMetrics>;
  analyzedVideoCount: number;
  analyzedViews: number;
  averageViewsPerVideo: number;
  averageEngagementRate?: number;
  averagePublishingIntervalDays?: number;
  publishingIntervalVariation?: number;
  subscriberReachRate?: number;
  dataCompleteness: number;
};

export type AnalysisScoreKind =
  | "content"
  | "consistency"
  | "optimization"
  | "growth";

export type AnalysisScoreAvailability =
  | "calculated"
  | "insufficient-data";

export type AnalysisScoreEvidence = {
  metric: string;
  value: number;
};

export type AnalysisScore = {
  kind: AnalysisScoreKind;
  value: number;
  availability: AnalysisScoreAvailability;
  evidence: ReadonlyArray<AnalysisScoreEvidence>;
};

export type GrowthOpportunityImpact =
  | "low"
  | "medium"
  | "high";

export type GrowthOpportunity = {
  id: string;
  code:
    | "improve-data-coverage"
    | "stabilize-publishing-cadence"
    | "review-low-reach-content";
  impact: GrowthOpportunityImpact;
  evidence: ReadonlyArray<AnalysisScoreEvidence>;
};

export type RecommendationPriority =
  | "low"
  | "medium"
  | "high";

export type Recommendation = {
  id: string;
  opportunityId: string;
  actionCode: string;
  rationaleCode: string;
  priority: RecommendationPriority;
  evidenceMetrics: ReadonlyArray<string>;
};

export type AnalysisResult = {
  analysisId: string;
  analyzedAt: string;
  creator: CreatorProfile;
  channel: ChannelProfile;
  metrics: ChannelMetrics;
  scores: ReadonlyArray<AnalysisScore>;
  opportunities: ReadonlyArray<GrowthOpportunity>;
  recommendations: ReadonlyArray<Recommendation>;
  limitations: ReadonlyArray<string>;
  strategicProjection?: StrategicAnalysisProjection;
};

export type RawCreatorProfile = {
  id: string;
  displayName?: string | null;
  locale?: string | null;
};

export type RawChannelProfile = {
  id: string;
  creatorId: string;
  name?: string | null;
  createdAt?: string | null;
  language?: string | null;
  market?: string | null;
  subscribers: number;
  totalViews?: number | null;
  totalVideos?: number | null;
};

export type RawVideoMetrics = {
  id: string;
  title?: string | null;
  publishedAt: string;
  views: number;
  likes?: number | null;
  comments?: number | null;
  durationSeconds?: number | null;
  averageViewDurationSeconds?: number | null;
  averagePercentageViewed?: number | null;
  subscribersGained?: number | null;
};

export type RawChannelData = {
  collectedAt: string;
  creator: RawCreatorProfile;
  channel: RawChannelProfile;
  videos: ReadonlyArray<RawVideoMetrics>;
};

export type NormalizedChannelData = {
  collectedAt: string;
  creator: CreatorProfile;
  channel: ChannelProfile;
  subscriberCount: number;
  reportedTotalViews?: number;
  reportedVideoCount?: number;
  videos: ReadonlyArray<VideoMetrics>;
};
