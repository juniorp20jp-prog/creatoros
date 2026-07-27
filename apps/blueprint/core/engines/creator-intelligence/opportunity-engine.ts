import type { OpportunityEngine } from "./contracts";
import type {
  ChannelMetrics,
  GrowthOpportunity,
} from "./domain-models";

export const CREATOR_INTELLIGENCE_OPPORTUNITY_THRESHOLDS = {
  minimumDataCompleteness: 0.75,
  highImpactDataCompleteness: 0.5,
  maximumPublishingIntervalVariation: 0.5,
  minimumSubscriberReachRate: 10,
} as const;

export class DefaultOpportunityEngine implements OpportunityEngine {
  find(
    metrics: ChannelMetrics,
  ): ReadonlyArray<GrowthOpportunity> {
    const opportunities: GrowthOpportunity[] = [];

    if (
      metrics.dataCompleteness <
      CREATOR_INTELLIGENCE_OPPORTUNITY_THRESHOLDS
        .minimumDataCompleteness
    ) {
      opportunities.push({
        id: `opportunity:${metrics.channelId}:data-coverage`,
        code: "improve-data-coverage",
        impact:
          metrics.dataCompleteness <
          CREATOR_INTELLIGENCE_OPPORTUNITY_THRESHOLDS
            .highImpactDataCompleteness
            ? "high"
            : "medium",
        evidence: [
          {
            metric: "data-completeness",
            value: metrics.dataCompleteness,
          },
        ],
      });
    }

    if (
      metrics.publishingIntervalVariation !== undefined &&
      metrics.publishingIntervalVariation >
        CREATOR_INTELLIGENCE_OPPORTUNITY_THRESHOLDS
          .maximumPublishingIntervalVariation
    ) {
      opportunities.push({
        id: `opportunity:${metrics.channelId}:publishing-cadence`,
        code: "stabilize-publishing-cadence",
        impact: "medium",
        evidence: [
          {
            metric: "publishing-interval-variation",
            value: metrics.publishingIntervalVariation,
          },
        ],
      });
    }

    if (
      metrics.subscriberReachRate !== undefined &&
      metrics.subscriberReachRate <
        CREATOR_INTELLIGENCE_OPPORTUNITY_THRESHOLDS
          .minimumSubscriberReachRate
    ) {
      opportunities.push({
        id: `opportunity:${metrics.channelId}:subscriber-reach`,
        code: "review-low-reach-content",
        impact: "high",
        evidence: [
          {
            metric: "subscriber-reach-rate",
            value: metrics.subscriberReachRate,
          },
        ],
      });
    }

    return opportunities;
  }
}
