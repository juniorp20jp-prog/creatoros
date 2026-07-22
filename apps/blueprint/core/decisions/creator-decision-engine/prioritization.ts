import { CREATOR_DECISION_THRESHOLDS } from "./configuration";
import type { DecisionCandidate, DecisionPrioritizer } from "./contracts";
import type {
  CreatorDecision,
  DecisionConfidence,
  DecisionPriority,
} from "./domain";

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function priorityForScore(score: number): DecisionPriority {
  const levels = CREATOR_DECISION_THRESHOLDS.prioritization.levels;
  if (score >= levels.highMinimum) {
    return "high";
  }
  if (score >= levels.mediumMinimum) {
    return "medium";
  }
  return "low";
}

export function createPrioritizedDecision(
  candidate: DecisionCandidate,
  confidence: DecisionConfidence,
): CreatorDecision {
  const weights = CREATOR_DECISION_THRESHOLDS.prioritization.weights;
  const score = round(
    candidate.assessment.impact * weights.impact +
      confidence.score * weights.confidence +
      candidate.assessment.urgency * weights.urgency +
      (1 - candidate.assessment.effort) * weights.inverseEffort +
      candidate.assessment.strategicRelevance * weights.strategicRelevance,
  );

  return {
    id: candidate.id,
    ruleId: candidate.ruleId,
    title: candidate.title,
    summary: candidate.summary,
    category: candidate.category,
    priority: priorityForScore(score),
    status: "proposed",
    observation: candidate.observation,
    interpretation: candidate.interpretation,
    recommendedAction: candidate.recommendedAction,
    expectedImpact: candidate.expectedImpact,
    confidence,
    evidence: candidate.evidence,
    alternatives: candidate.alternatives,
    metrics: candidate.metrics,
    prioritization: {
      score,
      impact: candidate.assessment.impact,
      urgency: candidate.assessment.urgency,
      effort: candidate.assessment.effort,
      strategicRelevance: candidate.assessment.strategicRelevance,
    },
    createdAt: candidate.createdAt,
    ...(candidate.sourceMetadata === undefined
      ? {}
      : { sourceMetadata: candidate.sourceMetadata }),
  };
}

function compareDecisions(left: CreatorDecision, right: CreatorDecision): number {
  return (
    right.prioritization.score - left.prioritization.score ||
    right.confidence.score - left.confidence.score ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.id.localeCompare(right.id)
  );
}

export class StableDecisionPrioritizer implements DecisionPrioritizer {
  prioritize(
    decisions: ReadonlyArray<CreatorDecision>,
    deduplicationKeys: ReadonlyMap<string, string>,
  ): ReadonlyArray<CreatorDecision> {
    const ordered = [...decisions].sort(compareDecisions);
    const selectedByKey = new Map<string, CreatorDecision>();

    for (const decision of ordered) {
      const key = deduplicationKeys.get(decision.id) ?? decision.id;
      if (!selectedByKey.has(key)) {
        selectedByKey.set(key, decision);
      }
    }

    return [...selectedByKey.values()].sort(compareDecisions);
  }
}

