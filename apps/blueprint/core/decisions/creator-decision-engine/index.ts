export {
  adaptYouTubeIntelligenceToDecisionInput,
  YouTubeIntelligenceSignalExtractor,
  type YouTubeDecisionAdapterResult,
} from "./adapters/youtube-intelligence-adapter";
export { calculateDecisionConfidence } from "./confidence";
export { CREATOR_DECISION_THRESHOLDS } from "./configuration";
export type {
  DecisionCandidate,
  DecisionEngine,
  DecisionPrioritizer,
  DecisionRule,
  DecisionRuleAssessment,
  InsightGenerator,
  SignalExtractor,
} from "./contracts";
export {
  CREATOR_DECISION_ENGINE_VERSION,
  CreatorDecisionEngine,
  creatorDecisionEngine,
  DEFAULT_CREATOR_DECISION_RULES,
  generateCreatorDecisions,
  generateCreatorDecisionsFromYouTubeAnalytics,
} from "./creator-decision-engine";
export type {
  CreatorDecision,
  CreatorDecisionInput,
  CreatorInsight,
  CreatorSignal,
  CreatorSignalDimension,
  DecisionAlternative,
  DecisionAnalysisContext,
  DecisionCategory,
  DecisionConfidence,
  DecisionConfidenceFactor,
  DecisionConfidenceFactorId,
  DecisionConfidenceLevel,
  DecisionEvidence,
  DecisionEvidenceKind,
  DecisionGenerationResult,
  DecisionMessage,
  DecisionMessageParameters,
  DecisionMetric,
  DecisionMetricTarget,
  DecisionPrioritization,
  DecisionPriority,
  DecisionSourceMetadata,
  DecisionStatus,
  DecisionValidationIssue,
} from "./domain";
export {
  validateCreatorDecision,
  validateCreatorDecisionInput,
} from "./domain";
export {
  HIGH_PERFORMING_PATTERN_RULE_ID,
  highPerformingPatternRule,
  LOW_CLICK_THROUGH_RULE_ID,
  lowClickThroughRule,
  PUBLISHING_INCONSISTENCY_RULE_ID,
  publishingInconsistencyRule,
  STRONG_REACH_WEAK_RETENTION_RULE_ID,
  strongReachWeakRetentionRule,
} from "./rules";
export {
  createPrioritizedDecision,
  StableDecisionPrioritizer,
} from "./prioritization";

