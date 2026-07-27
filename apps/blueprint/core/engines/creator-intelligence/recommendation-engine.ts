import type { RecommendationEngine } from "./contracts";
import type {
  AnalysisResult,
  GrowthOpportunity,
  Recommendation,
} from "./domain-models";

const recommendationCodes: Readonly<
  Record<
    GrowthOpportunity["code"],
    {
      actionCode: string;
      rationaleCode: string;
    }
  >
> = {
  "improve-data-coverage": {
    actionCode: "collect-missing-channel-metrics",
    rationaleCode: "analysis-data-coverage-below-threshold",
  },
  "stabilize-publishing-cadence": {
    actionCode: "define-repeatable-publishing-cadence",
    rationaleCode: "publishing-intervals-vary",
  },
  "review-low-reach-content": {
    actionCode: "review-content-with-low-subscriber-reach",
    rationaleCode: "average-views-low-relative-to-subscribers",
  },
};

export class DefaultRecommendationEngine
  implements RecommendationEngine
{
  recommend(result: AnalysisResult): ReadonlyArray<Recommendation> {
    return result.opportunities.map((opportunity) => {
      const codes = recommendationCodes[opportunity.code];

      return {
        id: `recommendation:${opportunity.id}`,
        opportunityId: opportunity.id,
        actionCode: codes.actionCode,
        rationaleCode: codes.rationaleCode,
        priority: opportunity.impact,
        evidenceMetrics: opportunity.evidence.map(
          (item) => item.metric,
        ),
      };
    });
  }
}
