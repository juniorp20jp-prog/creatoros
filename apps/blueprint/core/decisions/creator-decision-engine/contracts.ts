import type {
  CreatorDecision,
  CreatorDecisionInput,
  CreatorInsight,
  CreatorSignal,
  DecisionCategory,
  DecisionEvidence,
  DecisionGenerationResult,
  DecisionMessage,
  DecisionMetric,
  DecisionAlternative,
  DecisionSourceMetadata,
} from "./domain";

export type DecisionRuleAssessment = {
  impact: number;
  urgency: number;
  effort: number;
  strategicRelevance: number;
};

export type DecisionCandidate = {
  id: string;
  ruleId: string;
  deduplicationKey: string;
  title: DecisionMessage;
  summary: DecisionMessage;
  category: DecisionCategory;
  observation: DecisionMessage;
  interpretation: DecisionMessage;
  recommendedAction: DecisionMessage;
  expectedImpact: DecisionMessage;
  evidence: ReadonlyArray<DecisionEvidence>;
  alternatives: ReadonlyArray<DecisionAlternative>;
  metrics: ReadonlyArray<DecisionMetric>;
  supportingSignalIds: ReadonlyArray<string>;
  assessment: DecisionRuleAssessment;
  createdAt: string;
  sourceMetadata?: DecisionSourceMetadata;
};

export interface SignalExtractor<TSource> {
  extract(source: TSource): ReadonlyArray<CreatorSignal>;
}

export interface InsightGenerator {
  generate(signals: ReadonlyArray<CreatorSignal>): ReadonlyArray<CreatorInsight>;
}

export interface DecisionRule {
  readonly id: string;
  readonly requiredDimensions: ReadonlyArray<CreatorSignal["dimension"]>;
  evaluate(input: CreatorDecisionInput): DecisionCandidate | null;
}

export interface DecisionPrioritizer {
  prioritize(
    decisions: ReadonlyArray<CreatorDecision>,
    deduplicationKeys: ReadonlyMap<string, string>,
  ): ReadonlyArray<CreatorDecision>;
}

export interface DecisionEngine {
  generateDecisions(input: CreatorDecisionInput): DecisionGenerationResult;
}

