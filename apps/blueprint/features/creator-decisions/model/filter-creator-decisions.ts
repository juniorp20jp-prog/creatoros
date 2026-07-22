import type {
  CreatorDecision,
  DecisionCategory,
  DecisionPriority,
} from "../../../core";
import type {
  CreatorDecisionFilters,
  DecisionFilterValue,
} from "../types";

const PRIORITIES: ReadonlyArray<DecisionPriority> = ["high", "medium", "low"];
const CATEGORIES: ReadonlyArray<DecisionCategory> = [
  "content-packaging",
  "audience-retention",
  "publishing",
  "content-strategy",
  "growth",
];

export function parsePriorityFilter(
  value: string | undefined,
): DecisionFilterValue<DecisionPriority> {
  return value !== undefined && PRIORITIES.includes(value as DecisionPriority)
    ? (value as DecisionPriority)
    : "all";
}

export function parseCategoryFilter(
  value: string | undefined,
): DecisionFilterValue<DecisionCategory> {
  return value !== undefined && CATEGORIES.includes(value as DecisionCategory)
    ? (value as DecisionCategory)
    : "all";
}

export function filterCreatorDecisions(
  decisions: ReadonlyArray<CreatorDecision>,
  filters: CreatorDecisionFilters,
): ReadonlyArray<CreatorDecision> {
  return decisions.filter(
    (decision) =>
      (filters.priority === "all" || decision.priority === filters.priority) &&
      (filters.category === "all" || decision.category === filters.category),
  );
}

