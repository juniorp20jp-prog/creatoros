import { CREATOR_DECISION_THRESHOLDS } from "../configuration";
import type { DecisionRule } from "../contracts";
import {
  message,
  numericEvidence,
  relatedEntityOverlap,
  signalByDimension,
  uniqueEvidence,
} from "./rule-helpers";

export const STRONG_REACH_WEAK_RETENTION_RULE_ID =
  "decision-rule.strong-reach-weak-retention";

export const strongReachWeakRetentionRule: DecisionRule = {
  id: STRONG_REACH_WEAK_RETENTION_RULE_ID,
  requiredDimensions: ["content-reach", "retention"],
  evaluate(input) {
    const reach = signalByDimension(input, "content-reach", "positive");
    const retention = signalByDimension(input, "retention", "negative");
    if (
      reach === null ||
      retention === null ||
      (retention.sampleSize ?? 0) <
        CREATOR_DECISION_THRESHOLDS.rules.minimumMetricSampleSize
    ) {
      return null;
    }

    const relatedEntityIds = relatedEntityOverlap(reach, retention);
    if (relatedEntityIds.length === 0) {
      return null;
    }

    const retentionBaseline = numericEvidence(
      retention.evidence,
      "channelMetricMedian",
    );
    const assessment =
      CREATOR_DECISION_THRESHOLDS.rules.assessments
        .strongReachWeakRetention;
    return {
      id: `decision.strong-reach-weak-retention.${input.creatorId}`,
      ruleId: STRONG_REACH_WEAK_RETENTION_RULE_ID,
      deduplicationKey: "audience-retention.reach-retention-gap",
      title: message(
        "creatorDecisions.rules.strongReachWeakRetention.title",
        "Align the opening with the promise of high-reach content",
      ),
      summary: message(
        "creatorDecisions.rules.strongReachWeakRetention.summary",
        "Content that reached an above-baseline audience also showed below-baseline retention.",
        { relatedEntityCount: relatedEntityIds.length },
      ),
      category: "audience-retention",
      observation: message(
        "creatorDecisions.rules.strongReachWeakRetention.observation",
        "Reach and retention signals overlap on the same content items.",
        { relatedEntityCount: relatedEntityIds.length },
      ),
      interpretation: message(
        "creatorDecisions.rules.strongReachWeakRetention.interpretation",
        "The packaging attracted initial attention, but the viewing experience may not have sustained the promise for these items.",
      ),
      recommendedAction: message(
        "creatorDecisions.rules.strongReachWeakRetention.action",
        "For the next related item, test an opening that states the promised outcome early and measure retention against the current creator median.",
      ),
      expectedImpact: message(
        "creatorDecisions.rules.strongReachWeakRetention.impact",
        "A better promise-to-opening match should improve early viewing continuity while preserving reach.",
      ),
      evidence: uniqueEvidence([reach, retention]),
      alternatives: [
        {
          id: "alternative.strong-reach-weak-retention.packaging-only",
          action: message(
            "creatorDecisions.rules.strongReachWeakRetention.alternatives.packaging.action",
            "Change only the title or visual packaging.",
          ),
          discardedBecause: message(
            "creatorDecisions.rules.strongReachWeakRetention.alternatives.packaging.reason",
            "Reach is already above baseline on the same content items.",
          ),
          reconsiderWhen: message(
            "creatorDecisions.rules.strongReachWeakRetention.alternatives.packaging.condition",
            "Reconsider if reach falls below baseline in the next measured sample.",
          ),
        },
      ],
      metrics: [
        {
          id: "metric.audience-retention",
          label: message(
            "creatorDecisions.metrics.audienceRetention",
            "Audience retention",
          ),
          unit: "percentage-points",
          baseline: retentionBaseline,
          target: {
            direction: "increase",
            comparison: "source-median",
          },
          sourceSignalIds: [retention.id],
        },
        {
          id: "metric.content-reach",
          label: message(
            "creatorDecisions.metrics.contentReach",
            "Content reach relative to creator baseline",
          ),
          unit: "ratio",
          baseline: numericEvidence(reach.evidence, "maximumMedianRatio"),
          target: {
            direction: "maintain",
            comparison: "creator-baseline",
          },
          sourceSignalIds: [reach.id],
        },
      ],
      supportingSignalIds: [reach.id, retention.id],
      assessment: {
        impact: Math.max(reach.magnitude, retention.magnitude),
        ...assessment,
      },
      createdAt: input.context.analysisDate,
      ...(input.sourceMetadata === undefined
        ? {}
        : { sourceMetadata: input.sourceMetadata }),
    };
  },
};
