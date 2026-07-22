import { CREATOR_DECISION_THRESHOLDS } from "../configuration";
import type { DecisionRule } from "../contracts";
import { message, numericEvidence, signalByDimension } from "./rule-helpers";

export const LOW_CLICK_THROUGH_RULE_ID = "decision-rule.low-click-through";

export const lowClickThroughRule: DecisionRule = {
  id: LOW_CLICK_THROUGH_RULE_ID,
  requiredDimensions: ["click-through-performance"],
  evaluate(input) {
    const signal = signalByDimension(
      input,
      "click-through-performance",
      "negative",
    );
    if (
      signal === null ||
      (signal.sampleSize ?? 0) <
        CREATOR_DECISION_THRESHOLDS.rules.minimumMetricSampleSize
    ) {
      return null;
    }

    const baseline = numericEvidence(signal.evidence, "channelMetricMedian");
    const sampleSize = signal.sampleSize ?? 0;
    const assessment =
      CREATOR_DECISION_THRESHOLDS.rules.assessments.lowClickThrough;
    return {
      id: `decision.low-click-through.${input.creatorId}`,
      ruleId: LOW_CLICK_THROUGH_RULE_ID,
      deduplicationKey: "content-packaging.click-through",
      title: message(
        "creatorDecisions.rules.lowClickThrough.title",
        "Test content packaging on videos with below-baseline click-through performance",
      ),
      summary: message(
        "creatorDecisions.rules.lowClickThrough.summary",
        "A measured group of videos has click-through performance below this creator's own median.",
        { sampleSize },
      ),
      category: "content-packaging",
      observation: message(
        "creatorDecisions.rules.lowClickThrough.observation",
        "Below-baseline click-through performance was observed in the supplied sample.",
        { sampleSize, baseline: baseline ?? "unavailable" },
      ),
      interpretation: message(
        "creatorDecisions.rules.lowClickThrough.interpretation",
        "Packaging may be limiting the conversion of eligible impressions; the evidence is relative to this creator, not a universal benchmark.",
      ),
      recommendedAction: message(
        "creatorDecisions.rules.lowClickThrough.action",
        "Run one controlled title or thumbnail test on the related videos and compare click-through performance with the current creator median.",
      ),
      expectedImpact: message(
        "creatorDecisions.rules.lowClickThrough.impact",
        "Improved packaging should increase click-through performance if packaging is the limiting factor.",
      ),
      evidence: signal.evidence,
      alternatives: [
        {
          id: "alternative.low-click-through.no-change",
          action: message(
            "creatorDecisions.rules.lowClickThrough.alternatives.monitor.action",
            "Keep current packaging and collect a larger sample.",
          ),
          discardedBecause: message(
            "creatorDecisions.rules.lowClickThrough.alternatives.monitor.reason",
            "The current sample already meets the minimum evidence contract.",
          ),
          reconsiderWhen: message(
            "creatorDecisions.rules.lowClickThrough.alternatives.monitor.condition",
            "Reconsider if the controlled test cannot isolate a packaging change.",
          ),
        },
      ],
      metrics: [
        {
          id: "metric.click-through-performance",
          label: message(
            "creatorDecisions.metrics.clickThroughPerformance",
            "Click-through performance",
          ),
          unit: "percentage-points",
          baseline,
          target: {
            direction: "increase",
            comparison: "source-median",
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
