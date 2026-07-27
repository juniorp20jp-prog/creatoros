import type { ScoreEngine } from "./contracts";
import type {
  AnalysisScore,
  AnalysisScoreKind,
  ChannelMetrics,
} from "./domain-models";

export const CREATOR_INTELLIGENCE_SCORE_THRESHOLDS = {
  targetEngagementRate: 5,
  targetSubscriberReachRate: 20,
} as const;

function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) /
    100;
}

function unavailable(kind: AnalysisScoreKind): AnalysisScore {
  return {
    kind,
    value: 0,
    availability: "insufficient-data",
    evidence: [],
  };
}

export class DefaultScoreEngine implements ScoreEngine {
  calculate(metrics: ChannelMetrics): ReadonlyArray<AnalysisScore> {
    const content =
      metrics.averageEngagementRate === undefined
        ? unavailable("content")
        : {
            kind: "content" as const,
            value: clampScore(
              (metrics.averageEngagementRate /
                CREATOR_INTELLIGENCE_SCORE_THRESHOLDS
                  .targetEngagementRate) *
                100,
            ),
            availability: "calculated" as const,
            evidence: [
              {
                metric: "average-engagement-rate",
                value: metrics.averageEngagementRate,
              },
            ],
          };
    const consistency =
      metrics.publishingIntervalVariation === undefined
        ? unavailable("consistency")
        : {
            kind: "consistency" as const,
            value: clampScore(
              (1 - metrics.publishingIntervalVariation) * 100,
            ),
            availability: "calculated" as const,
            evidence: [
              {
                metric: "publishing-interval-variation",
                value: metrics.publishingIntervalVariation,
              },
            ],
          };
    const optimization: AnalysisScore = {
      kind: "optimization",
      value: clampScore(metrics.dataCompleteness * 100),
      availability: "calculated",
      evidence: [
        {
          metric: "data-completeness",
          value: metrics.dataCompleteness,
        },
      ],
    };
    const growth =
      metrics.subscriberReachRate === undefined
        ? unavailable("growth")
        : {
            kind: "growth" as const,
            value: clampScore(
              (metrics.subscriberReachRate /
                CREATOR_INTELLIGENCE_SCORE_THRESHOLDS
                  .targetSubscriberReachRate) *
                100,
            ),
            availability: "calculated" as const,
            evidence: [
              {
                metric: "subscriber-reach-rate",
                value: metrics.subscriberReachRate,
              },
            ],
          };

    return [content, consistency, optimization, growth];
  }
}
