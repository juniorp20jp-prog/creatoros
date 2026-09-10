import type {
  CreatorDecision,
  DecisionCategory,
  DecisionPriority,
} from "../../../core";
import {
  formatDecisionDate,
  formatDecisionEvidenceValue,
  formatDecisionMetricBaseline,
  formatDecisionPeriod,
  resolveDecisionMessage,
} from "../formatters";
import type {
  CreateDecisionCenterViewModelInput,
  CreatorDecisionCenterViewModel,
  CreatorDecisionViewModel,
  DecisionFilterViewModel,
  DecisionSourceViewModel,
  DecisionSummaryViewModel,
} from "../types";
import { filterCreatorDecisions } from "./filter-creator-decisions";

const PRIORITIES: ReadonlyArray<DecisionPriority> = ["high", "medium", "low"];
const CATEGORIES: ReadonlyArray<DecisionCategory> = [
  "content-packaging",
  "audience-retention",
  "publishing",
  "content-strategy",
  "growth",
];

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function mapDecision(
  decision: CreatorDecision,
  input: CreateDecisionCenterViewModelInput,
): CreatorDecisionViewModel {
  const { content, locale } = input;
  const target = (metric: CreatorDecision["metrics"][number]) =>
    `${content.targets.directions[metric.target.direction]} · ${content.targets.comparisons[metric.target.comparison]}`;

  return {
    id: decision.id,
    ruleId: decision.ruleId,
    title: resolveDecisionMessage(content, decision.title),
    summary: resolveDecisionMessage(content, decision.summary),
    category: decision.category,
    categoryLabel: content.categories[decision.category],
    priority: decision.priority,
    priorityLabel: content.priorities[decision.priority],
    confidence: decision.confidence.level,
    confidenceLabel: content.confidence.values[decision.confidence.level],
    confidenceScore: formatPercent(decision.confidence.score, locale),
    confidenceExplanation: resolveDecisionMessage(
      content,
      decision.confidence.explanation,
    ),
    observation: resolveDecisionMessage(content, decision.observation),
    interpretation: resolveDecisionMessage(content, decision.interpretation),
    recommendedAction: resolveDecisionMessage(
      content,
      decision.recommendedAction,
    ),
    expectedImpact: resolveDecisionMessage(content, decision.expectedImpact),
    evidence: decision.evidence.map((evidence) => ({
      id: evidence.id,
      label: resolveDecisionMessage(content, evidence.label),
      value: formatDecisionEvidenceValue(evidence, locale),
      sourceRef: evidence.sourceRef,
    })),
    metrics: decision.metrics.map((metric) => ({
      id: metric.id,
      label: resolveDecisionMessage(content, metric.label),
      baseline: formatDecisionMetricBaseline(
        metric,
        locale,
        content.common.notAvailable,
      ),
      target: target(metric),
    })),
    alternatives: decision.alternatives.map((alternative) => ({
      id: alternative.id,
      action: resolveDecisionMessage(content, alternative.action),
      discardedBecause: resolveDecisionMessage(
        content,
        alternative.discardedBecause,
      ),
      reconsiderWhen: resolveDecisionMessage(
        content,
        alternative.reconsiderWhen,
      ),
    })),
    createdAt: formatDecisionDate(decision.createdAt, locale),
  };
}

function mapSource(
  input: CreateDecisionCenterViewModelInput,
): DecisionSourceViewModel {
  const { content, locale, source } = input;
  return {
    channelName: source.channelName,
    analysisDate: formatDecisionDate(source.analysisDate, locale),
    period: formatDecisionPeriod(source.period, locale),
    sampleSize:
      source.sampleSize === null
        ? content.common.notAvailable
        : new Intl.NumberFormat(locale).format(source.sampleSize),
    qualityLabel: content.quality[source.quality],
    demo: input.mode !== "real",
  };
}

function mapFilters(
  input: CreateDecisionCenterViewModelInput,
): DecisionFilterViewModel {
  return {
    selected: input.filters,
    priorityOptions: [
      { value: "all", label: input.content.filters.allPriorities },
      ...PRIORITIES.map((priority) => ({
        value: priority,
        label: input.content.priorities[priority],
      })),
    ],
    categoryOptions: [
      { value: "all", label: input.content.filters.allCategories },
      ...CATEGORIES.map((category) => ({
        value: category,
        label: input.content.categories[category],
      })),
    ],
  };
}

function mapSummary(
  decisions: ReadonlyArray<CreatorDecision>,
  input: CreateDecisionCenterViewModelInput,
): DecisionSummaryViewModel {
  const confidenceCounts = {
    high: decisions.filter((decision) => decision.confidence.level === "high")
      .length,
    medium: decisions.filter(
      (decision) => decision.confidence.level === "medium",
    ).length,
    low: decisions.filter((decision) => decision.confidence.level === "low")
      .length,
  };
  return {
    total: decisions.length,
    high: decisions.filter((decision) => decision.priority === "high").length,
    medium: decisions.filter((decision) => decision.priority === "medium").length,
    low: decisions.filter((decision) => decision.priority === "low").length,
    highestPriorityAction:
      decisions[0] === undefined
        ? null
        : resolveDecisionMessage(
            input.content,
            decisions[0].recommendedAction,
          ),
    confidenceSummary: input.content.summary.confidenceDistribution
      .replace("{high}", String(confidenceCounts.high))
      .replace("{medium}", String(confidenceCounts.medium))
      .replace("{low}", String(confidenceCounts.low)),
  };
}

export function createCreatorDecisionCenterViewModel(
  input: CreateDecisionCenterViewModelInput,
): CreatorDecisionCenterViewModel {
  const source = mapSource(input);
  if (input.result.status === "failed") {
    const issue = input.result.issues[0];
    const validationError =
      issue?.code === "analytics-failed" &&
      issue.message === "YOUTUBE_INTELLIGENCE_VALIDATION_FAILED";
    return {
      state: validationError ? "validation-error" : "unexpected-error",
      scenarioId: input.scenarioId,
      source,
      errorCode: issue?.message ?? "CREATOR_DECISIONS_GENERATION_FAILED",
    };
  }

  const summary = mapSummary(input.result.decisions, input);
  const filters = mapFilters(input);
  if (input.result.decisions.length === 0) {
    return {
      state: input.source.hasInsufficientEvidence
        ? "insufficient-data"
        : "empty",
      scenarioId: input.scenarioId,
      source,
      decisions: [],
      totalDecisionCount: 0,
      summary,
      filters,
    };
  }

  const filtered = filterCreatorDecisions(input.result.decisions, input.filters);
  return {
    state: "populated",
    scenarioId: input.scenarioId,
    source,
    totalDecisionCount: input.result.decisions.length,
    summary,
    filters,
    decisions: filtered.map((decision) => mapDecision(decision, input)),
  };
}

