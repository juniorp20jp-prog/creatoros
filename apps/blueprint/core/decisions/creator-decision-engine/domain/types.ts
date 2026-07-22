export type DecisionPriority = "high" | "medium" | "low";

export type DecisionConfidenceLevel = "high" | "medium" | "low";

export type DecisionCategory =
  | "content-packaging"
  | "audience-retention"
  | "publishing"
  | "content-strategy"
  | "growth";

export type DecisionStatus =
  | "proposed"
  | "accepted"
  | "in-progress"
  | "completed"
  | "dismissed";

export type CreatorSignalDimension =
  | "audience-growth"
  | "content-reach"
  | "engagement"
  | "publishing-consistency"
  | "click-through-performance"
  | "retention"
  | "content-concentration"
  | "recent-momentum"
  | "content-pattern"
  | "monetization";

export type DecisionMessageParameters = Readonly<
  Record<string, string | number>
>;

export type DecisionMessage = {
  messageKey: string;
  defaultMessage: string;
  parameters: DecisionMessageParameters;
};

export type DecisionEvidenceKind =
  | "signal"
  | "metric"
  | "comparison"
  | "sample"
  | "quality";

export type DecisionEvidenceValue = string | number;

export type DecisionEvidence = {
  id: string;
  kind: DecisionEvidenceKind;
  label: DecisionMessage;
  value: DecisionEvidenceValue;
  unit: string;
  sourceRef: string;
  sourceSignalIds: ReadonlyArray<string>;
};

export type CreatorSignal = {
  id: string;
  dimension: CreatorSignalDimension;
  direction: "positive" | "negative" | "neutral";
  magnitude: number;
  confidenceHint: number;
  sampleSize: number | null;
  observedAt: string;
  evidence: ReadonlyArray<DecisionEvidence>;
  relatedEntityIds: ReadonlyArray<string>;
  tags: ReadonlyArray<string>;
};

export type CreatorInsight = {
  id: string;
  category: "risk" | "opportunity" | "pattern" | "finding" | "data-quality";
  statement: DecisionMessage;
  sourceSignalIds: ReadonlyArray<string>;
  evidence: ReadonlyArray<DecisionEvidence>;
  confidenceHint: number;
  limitations: ReadonlyArray<string>;
  relatedEntityIds: ReadonlyArray<string>;
};

export type DecisionAlternative = {
  id: string;
  action: DecisionMessage;
  discardedBecause: DecisionMessage;
  reconsiderWhen: DecisionMessage;
};

export type DecisionMetricTarget = {
  direction: "increase" | "decrease" | "maintain";
  comparison: "creator-baseline" | "source-median" | "current-value";
  minimumRelativeChange?: number;
};

export type DecisionMetric = {
  id: string;
  label: DecisionMessage;
  unit: string;
  baseline: number | null;
  target: DecisionMetricTarget;
  sourceSignalIds: ReadonlyArray<string>;
};

export type DecisionConfidenceFactorId =
  | "data-availability"
  | "sample-size"
  | "signal-consistency"
  | "data-recency"
  | "deviation-strength";

export type DecisionConfidenceFactor = {
  id: DecisionConfidenceFactorId;
  score: number;
  weight: number;
};

export type DecisionConfidence = {
  score: number;
  level: DecisionConfidenceLevel;
  explanation: DecisionMessage;
  factors: ReadonlyArray<DecisionConfidenceFactor>;
};

export type DecisionPrioritization = {
  score: number;
  impact: number;
  urgency: number;
  effort: number;
  strategicRelevance: number;
};

export type DecisionSourceMetadata = {
  sourceKind: string;
  sourceId: string;
  executionId?: string;
  platform?: string;
  attributes: Readonly<Record<string, string | number | boolean>>;
};

export type CreatorDecision = {
  id: string;
  ruleId: string;
  title: DecisionMessage;
  summary: DecisionMessage;
  category: DecisionCategory;
  priority: DecisionPriority;
  status: DecisionStatus;
  observation: DecisionMessage;
  interpretation: DecisionMessage;
  recommendedAction: DecisionMessage;
  expectedImpact: DecisionMessage;
  confidence: DecisionConfidence;
  evidence: ReadonlyArray<DecisionEvidence>;
  alternatives: ReadonlyArray<DecisionAlternative>;
  metrics: ReadonlyArray<DecisionMetric>;
  prioritization: DecisionPrioritization;
  createdAt: string;
  sourceMetadata?: DecisionSourceMetadata;
};

export type DecisionAnalysisContext = {
  analysisDate: string;
  period: { startDate: string; endDate: string } | null;
  sampleSize: number;
  dataAvailability: number;
  creatorObjective: string | null;
};

export type CreatorDecisionInput = {
  creatorId: string;
  signals: ReadonlyArray<CreatorSignal>;
  insights: ReadonlyArray<CreatorInsight>;
  context: DecisionAnalysisContext;
  sourceMetadata?: DecisionSourceMetadata;
};

export type DecisionValidationIssue = {
  field: string;
  code: string;
  message: string;
};

export type DecisionGenerationResult =
  | {
      status: "completed";
      decisions: ReadonlyArray<CreatorDecision>;
      metadata: {
        creatorId: string;
        evaluatedRuleIds: ReadonlyArray<string>;
        generatedAt: string;
        signalCount: number;
        insightCount: number;
      };
    }
  | {
      status: "failed";
      decisions: readonly [];
      issues: ReadonlyArray<DecisionValidationIssue>;
      metadata: {
        creatorId: string;
        generatedAt: string | null;
      };
    };

