import { CREATOR_DECISION_THRESHOLDS } from "./configuration";
import type { DecisionCandidate } from "./contracts";
import type {
  CreatorDecisionInput,
  DecisionConfidence,
  DecisionConfidenceFactor,
  DecisionConfidenceLevel,
} from "./domain";

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function confidenceLevel(score: number): DecisionConfidenceLevel {
  const levels = CREATOR_DECISION_THRESHOLDS.confidence.levels;
  if (score >= levels.highMinimum) {
    return "high";
  }
  if (score >= levels.mediumMinimum) {
    return "medium";
  }
  return "low";
}

function recencyScore(input: CreatorDecisionInput): number {
  if (input.context.period === null) {
    return 0.5;
  }

  const analysisTime = Date.parse(input.context.analysisDate);
  const endTime = Date.parse(input.context.period.endDate);
  const ageDays = (analysisTime - endTime) / 86_400_000;
  const ranges = CREATOR_DECISION_THRESHOLDS.confidence.recencyDays;

  if (!Number.isFinite(ageDays) || ageDays < 0) {
    return 0;
  }
  if (ageDays <= ranges.current) {
    return 1;
  }
  if (ageDays <= ranges.recent) {
    return 0.8;
  }
  if (ageDays <= ranges.usable) {
    return 0.6;
  }
  if (ageDays <= ranges.historical) {
    return 0.4;
  }
  return 0.2;
}

function average(values: ReadonlyArray<number>): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

export function calculateDecisionConfidence(
  candidate: DecisionCandidate,
  input: CreatorDecisionInput,
): DecisionConfidence {
  const supportingSignals = input.signals.filter((signal) =>
    candidate.supportingSignalIds.includes(signal.id),
  );
  const weights = CREATOR_DECISION_THRESHOLDS.confidence.weights;
  const factors: ReadonlyArray<DecisionConfidenceFactor> = [
    {
      id: "data-availability",
      score: clamp(input.context.dataAvailability),
      weight: weights.dataAvailability,
    },
    {
      id: "sample-size",
      score: clamp(
        input.context.sampleSize /
          CREATOR_DECISION_THRESHOLDS.confidence.sampleSizeForFullScore,
      ),
      weight: weights.sampleSize,
    },
    {
      id: "signal-consistency",
      score: clamp(
        average(supportingSignals.map((signal) => signal.confidenceHint)),
      ),
      weight: weights.signalConsistency,
    },
    {
      id: "data-recency",
      score: recencyScore(input),
      weight: weights.dataRecency,
    },
    {
      id: "deviation-strength",
      score: clamp(average(supportingSignals.map((signal) => signal.magnitude))),
      weight: weights.deviationStrength,
    },
  ];
  const score = round(
    factors.reduce(
      (total, factor) => total + factor.score * factor.weight,
      0,
    ),
  );
  const level = confidenceLevel(score);

  return {
    score,
    level,
    explanation: {
      messageKey: `creatorDecisions.confidence.${level}`,
      defaultMessage: `Confidence is ${level} (${score}) based on data availability, sample size, signal consistency, recency, and deviation strength; it does not imply certainty.`,
      parameters: {
        score,
        level,
        supportingSignalCount: supportingSignals.length,
      },
    },
    factors,
  };
}

