import { CREATOR_DECISION_THRESHOLDS } from "../configuration";
import type { DecisionRule } from "../contracts";
import {
  message,
  numericEvidence,
  relatedEntityOverlap,
  signalByDimension,
  uniqueEvidence,
} from "./rule-helpers";

export const HIGH_PERFORMING_PATTERN_RULE_ID =
  "decision-rule.high-performing-pattern";

export const highPerformingPatternRule: DecisionRule = {
  id: HIGH_PERFORMING_PATTERN_RULE_ID,
  requiredDimensions: ["content-reach", "content-pattern"],
  evaluate(input) {
    const reach = signalByDimension(input, "content-reach", "positive");
    const pattern = signalByDimension(input, "content-pattern", "positive");
    if (
      reach === null ||
      pattern === null ||
      (reach.sampleSize ?? 0) <
        CREATOR_DECISION_THRESHOLDS.rules.minimumPatternSampleSize
    ) {
      return null;
    }

    const relatedEntityIds = relatedEntityOverlap(reach, pattern);
    if (relatedEntityIds.length === 0 || pattern.tags.length === 0) {
      return null;
    }

    const maximumMedianRatio = numericEvidence(
      reach.evidence,
      "maximumMedianRatio",
    );
    const assessment =
      CREATOR_DECISION_THRESHOLDS.rules.assessments.highPerformingPattern;
    return {
      id: `decision.high-performing-pattern.${input.creatorId}`,
      ruleId: HIGH_PERFORMING_PATTERN_RULE_ID,
      deduplicationKey: "content-strategy.high-performing-pattern",
      title: message(
        "creatorDecisions.rules.highPerformingPattern.title",
        "Validate a follow-up to the measured high-performing content pattern",
      ),
      summary: message(
        "creatorDecisions.rules.highPerformingPattern.summary",
        "An exceptional reach signal overlaps with a recurring deterministic content pattern.",
        {
          relatedEntityCount: relatedEntityIds.length,
          patternCount: pattern.tags.length,
        },
      ),
      category: "content-strategy",
      observation: message(
        "creatorDecisions.rules.highPerformingPattern.observation",
        "Recurring title terms appear in content that also exceeds the creator's reach baseline.",
        {
          relatedEntityCount: relatedEntityIds.length,
          maximumMedianRatio: maximumMedianRatio ?? "unavailable",
        },
      ),
      interpretation: message(
        "creatorDecisions.rules.highPerformingPattern.interpretation",
        "The overlap supports testing a related follow-up; it does not establish that the recurring terms caused performance.",
      ),
      recommendedAction: message(
        "creatorDecisions.rules.highPerformingPattern.action",
        "Publish one clearly related follow-up and compare its reach with the current creator median before expanding into a series.",
      ),
      expectedImpact: message(
        "creatorDecisions.rules.highPerformingPattern.impact",
        "A controlled follow-up can confirm whether the observed pattern remains useful for content planning.",
      ),
      evidence: uniqueEvidence([reach, pattern]),
      alternatives: [
        {
          id: "alternative.high-performing-pattern.series",
          action: message(
            "creatorDecisions.rules.highPerformingPattern.alternatives.series.action",
            "Commit immediately to a multi-item series.",
          ),
          discardedBecause: message(
            "creatorDecisions.rules.highPerformingPattern.alternatives.series.reason",
            "One observed overlap does not prove repeatable causation.",
          ),
          reconsiderWhen: message(
            "creatorDecisions.rules.highPerformingPattern.alternatives.series.condition",
            "Reconsider after a follow-up also performs above the creator baseline.",
          ),
        },
      ],
      metrics: [
        {
          id: "metric.follow-up-reach",
          label: message(
            "creatorDecisions.metrics.followUpReach",
            "Follow-up reach relative to creator median",
          ),
          unit: "ratio",
          baseline: maximumMedianRatio,
          target: {
            direction: "maintain",
            comparison: "source-median",
          },
          sourceSignalIds: [reach.id, pattern.id],
        },
      ],
      supportingSignalIds: [reach.id, pattern.id],
      assessment: {
        impact: (reach.magnitude + pattern.magnitude) / 2,
        ...assessment,
      },
      createdAt: input.context.analysisDate,
      ...(input.sourceMetadata === undefined
        ? {}
        : { sourceMetadata: input.sourceMetadata }),
    };
  },
};
