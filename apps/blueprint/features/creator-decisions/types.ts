import type {
  DecisionCategory,
  DecisionConfidenceLevel,
  DecisionGenerationResult,
  DecisionPriority,
} from "../../core";
import type { Locale } from "../../i18n/config";
import type { Dictionary } from "../../i18n/dictionaries";
import type { CreatorDecisionScenarioId } from "./fixtures";

export type CreatorDecisionDictionary =
  Dictionary["blueprint"]["creatorDecisions"];

export type DecisionFilterValue<TValue extends string> = "all" | TValue;

export type CreatorDecisionFilters = {
  priority: DecisionFilterValue<DecisionPriority>;
  category: DecisionFilterValue<DecisionCategory>;
};

export type DecisionSourceContext = {
  channelName: string;
  analysisDate: string;
  period: { startDate: string; endDate: string };
  sampleSize: number | null;
  quality: "complete" | "partial" | "limited" | "unavailable";
  hasInsufficientEvidence: boolean;
};

export type CreateDecisionCenterViewModelInput = {
  content: CreatorDecisionDictionary;
  filters: CreatorDecisionFilters;
  locale: Locale;
  result: DecisionGenerationResult;
  scenarioId: CreatorDecisionScenarioId;
  source: DecisionSourceContext;
};

export type DecisionEvidenceViewModel = {
  id: string;
  label: string;
  value: string;
  sourceRef: string;
};

export type DecisionMetricViewModel = {
  id: string;
  label: string;
  baseline: string;
  target: string;
};

export type DecisionAlternativeViewModel = {
  id: string;
  action: string;
  discardedBecause: string;
  reconsiderWhen: string;
};

export type CreatorDecisionViewModel = {
  id: string;
  ruleId: string;
  title: string;
  summary: string;
  category: DecisionCategory;
  categoryLabel: string;
  priority: DecisionPriority;
  priorityLabel: string;
  confidence: DecisionConfidenceLevel;
  confidenceLabel: string;
  confidenceScore: string;
  confidenceExplanation: string;
  observation: string;
  interpretation: string;
  recommendedAction: string;
  expectedImpact: string;
  evidence: ReadonlyArray<DecisionEvidenceViewModel>;
  metrics: ReadonlyArray<DecisionMetricViewModel>;
  alternatives: ReadonlyArray<DecisionAlternativeViewModel>;
  createdAt: string;
};

export type DecisionSummaryViewModel = {
  total: number;
  high: number;
  medium: number;
  low: number;
  highestPriorityAction: string | null;
  confidenceSummary: string;
};

export type DecisionSourceViewModel = {
  channelName: string;
  analysisDate: string;
  period: string;
  sampleSize: string;
  qualityLabel: string;
  demo: true;
};

export type DecisionFilterOption<TValue extends string> = {
  value: DecisionFilterValue<TValue>;
  label: string;
};

export type DecisionFilterViewModel = {
  selected: CreatorDecisionFilters;
  priorityOptions: ReadonlyArray<DecisionFilterOption<DecisionPriority>>;
  categoryOptions: ReadonlyArray<DecisionFilterOption<DecisionCategory>>;
};

type DecisionCenterBaseViewModel = {
  scenarioId: CreatorDecisionScenarioId;
  source: DecisionSourceViewModel;
};

export type DecisionCenterPopulatedViewModel = DecisionCenterBaseViewModel & {
  state: "populated";
  decisions: ReadonlyArray<CreatorDecisionViewModel>;
  totalDecisionCount: number;
  summary: DecisionSummaryViewModel;
  filters: DecisionFilterViewModel;
};

export type DecisionCenterEmptyViewModel = DecisionCenterBaseViewModel & {
  state: "empty" | "insufficient-data";
  decisions: readonly [];
  totalDecisionCount: 0;
  summary: DecisionSummaryViewModel;
  filters: DecisionFilterViewModel;
};

export type DecisionCenterErrorViewModel = DecisionCenterBaseViewModel & {
  state: "validation-error" | "unexpected-error";
  errorCode: string;
};

export type CreatorDecisionCenterViewModel =
  | DecisionCenterPopulatedViewModel
  | DecisionCenterEmptyViewModel
  | DecisionCenterErrorViewModel;

