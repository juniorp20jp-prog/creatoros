import type {
  AnalysisResult,
  AnalysisScore,
  ChannelMetrics,
  GrowthOpportunity,
  NormalizedChannelData,
  RawChannelData,
  Recommendation,
} from "./domain-models";

export type CreatorAnalysisPipelineContext = {
  analysisId: string;
  analyzedAt: string;
};

export type CreatorAnalysisPipelineResult = {
  analysis: AnalysisResult;
  completedStepIds: ReadonlyArray<string>;
};

export interface ChannelDataNormalizer {
  normalize(
    input: RawChannelData,
    context: CreatorAnalysisPipelineContext,
  ): NormalizedChannelData;
}

export interface ChannelMetricsCalculator {
  calculate(input: NormalizedChannelData): ChannelMetrics;
}

export interface ScoreEngine {
  calculate(metrics: ChannelMetrics): ReadonlyArray<AnalysisScore>;
}

export interface OpportunityEngine {
  find(metrics: ChannelMetrics): ReadonlyArray<GrowthOpportunity>;
}

export interface RecommendationEngine {
  recommend(result: AnalysisResult): ReadonlyArray<Recommendation>;
}
