import type {
  ChannelDataNormalizer,
  ChannelMetricsCalculator,
  CreatorAnalysisPipelineContext,
  CreatorAnalysisPipelineResult,
  OpportunityEngine,
  RecommendationEngine,
  ScoreEngine,
} from "./contracts";
import type {
  AnalysisResult,
  RawChannelData,
} from "./domain-models";
import { DefaultChannelMetricsCalculator } from "./metrics";
import { DefaultChannelDataNormalizer } from "./normalization";
import { DefaultOpportunityEngine } from "./opportunity-engine";
import { DefaultRecommendationEngine } from "./recommendation-engine";
import { DefaultScoreEngine } from "./score-engine";

export const CREATOR_ANALYSIS_PIPELINE_STEPS = [
  "normalization",
  "metrics",
  "scores",
  "opportunities",
  "recommendations",
] as const;

export class CreatorIntelligenceAnalysisPipeline {
  constructor(
    private readonly normalizer: ChannelDataNormalizer =
      new DefaultChannelDataNormalizer(),
    private readonly metricsCalculator: ChannelMetricsCalculator =
      new DefaultChannelMetricsCalculator(),
    private readonly scoreEngine: ScoreEngine =
      new DefaultScoreEngine(),
    private readonly opportunityEngine: OpportunityEngine =
      new DefaultOpportunityEngine(),
    private readonly recommendationEngine: RecommendationEngine =
      new DefaultRecommendationEngine(),
  ) {}

  run(
    input: RawChannelData,
    context: CreatorAnalysisPipelineContext,
  ): CreatorAnalysisPipelineResult {
    const normalized = this.normalizer.normalize(input, context);
    const metrics = this.metricsCalculator.calculate(normalized);
    const scores = this.scoreEngine.calculate(metrics);
    const opportunities = this.opportunityEngine.find(metrics);
    const limitations = this.limitations(metrics);
    const baseResult: AnalysisResult = {
      analysisId: context.analysisId,
      analyzedAt: context.analyzedAt,
      creator: normalized.creator,
      channel: normalized.channel,
      metrics,
      scores,
      opportunities,
      recommendations: [],
      limitations,
    };
    const recommendations =
      this.recommendationEngine.recommend(baseResult);

    return {
      analysis: {
        ...baseResult,
        recommendations,
      },
      completedStepIds: CREATOR_ANALYSIS_PIPELINE_STEPS,
    };
  }

  private limitations(
    metrics: {
      analyzedVideoCount: number;
      averageEngagementRate?: number;
      publishingIntervalVariation?: number;
      subscriberReachRate?: number;
    },
  ): ReadonlyArray<string> {
    const limitations: string[] = [
      "deterministic-foundation-no-external-analysis",
    ];

    if (metrics.analyzedVideoCount === 0) {
      limitations.push("no-videos-provided");
    }

    if (metrics.averageEngagementRate === undefined) {
      limitations.push("engagement-data-unavailable");
    }

    if (metrics.publishingIntervalVariation === undefined) {
      limitations.push("publishing-consistency-unavailable");
    }

    if (metrics.subscriberReachRate === undefined) {
      limitations.push("subscriber-reach-unavailable");
    }

    return limitations;
  }
}
