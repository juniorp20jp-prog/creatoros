import { CREATOR_DECISION_THRESHOLDS } from "../configuration";
import type { DecisionRule } from "../contracts";
import { message, numericEvidence, signalByDimension } from "./rule-helpers";

export const PUBLISHING_INCONSISTENCY_RULE_ID =
  "decision-rule.publishing-inconsistency";

export const publishingInconsistencyRule: DecisionRule = {
  id: PUBLISHING_INCONSISTENCY_RULE_ID,
  requiredDimensions: ["publishing-consistency"],
  evaluate(input) {
    const signal = signalByDimension(
      input,
      "publishing-consistency",
      "negative",
    );
    if (
      signal === null ||
      (signal.sampleSize ?? 0) <
        CREATOR_DECISION_THRESHOLDS.rules.minimumMetricSampleSize
    ) {
      return null;
    }

    const variation = numericEvidence(
      signal.evidence,
      "coefficientOfVariation",
    );
    const medianInterval = numericEvidence(
      signal.evidence,
      "medianIntervalDays",
    );
    const assessment =
      CREATOR_DECISION_THRESHOLDS.rules.assessments
        .publishingInconsistency;
    return {
      id: `decision.publishing-inconsistency.${input.creatorId}`,
      ruleId: PUBLISHING_INCONSISTENCY_RULE_ID,
      deduplicationKey: "publishing.consistency",
      title: message(
        "creatorDecisions.rules.publishingInconsistency.title",
        "Adopt a publishing cadence based on the creator's observed median interval",
      ),
      summary: message(
        "creatorDecisions.rules.publishingInconsistency.summary",
        "Publishing intervals vary materially across the analyzed period.",
        { variation: variation ?? "unavailable" },
      ),
      category: "publishing",
      observation: message(
        "creatorDecisions.rules.publishingInconsistency.observation",
        "The variation between publishing intervals exceeds the documented analytics threshold.",
        {
          variation: variation ?? "unavailable",
          medianIntervalDays: medianInterval ?? "unavailable",
        },
      ),
      interpretation: message(
        "creatorDecisions.rules.publishingInconsistency.interpretation",
        "An irregular cadence may make planning and repeat audience expectations harder to sustain.",
      ),
      recommendedAction: message(
        "creatorDecisions.rules.publishingInconsistency.action",
        "Plan the next three publishing dates around the observed median interval, then compare interval variation with the current baseline.",
        { medianIntervalDays: medianInterval ?? "unavailable" },
      ),
      expectedImpact: message(
        "creatorDecisions.rules.publishingInconsistency.impact",
        "A more repeatable cadence should reduce interval variation and improve operational predictability.",
      ),
      evidence: signal.evidence,
      alternatives: [
        {
          id: "alternative.publishing-inconsistency.lower-frequency",
          action: message(
            "creatorDecisions.rules.publishingInconsistency.alternatives.lowerFrequency.action",
            "Use a less frequent but explicitly scheduled cadence.",
          ),
          discardedBecause: message(
            "creatorDecisions.rules.publishingInconsistency.alternatives.lowerFrequency.reason",
            "The evidence supports reducing variation, not a specific universal frequency.",
          ),
          reconsiderWhen: message(
            "creatorDecisions.rules.publishingInconsistency.alternatives.lowerFrequency.condition",
            "Reconsider if the current median interval is not operationally sustainable.",
          ),
        },
      ],
      metrics: [
        {
          id: "metric.publishing-interval-variation",
          label: message(
            "creatorDecisions.metrics.publishingIntervalVariation",
            "Publishing interval variation",
          ),
          unit: "ratio",
          baseline: variation,
          target: {
            direction: "decrease",
            comparison: "current-value",
          },
          sourceSignalIds: [signal.id],
        },
      ],
      supportingSignalIds: [signal.id],
      assessment: {
        impact: signal.magnitude,
        ...assessment,
      },
      createdAt: input.context.analysisDate,
      ...(input.sourceMetadata === undefined
        ? {}
        : { sourceMetadata: input.sourceMetadata }),
    };
  },
};
