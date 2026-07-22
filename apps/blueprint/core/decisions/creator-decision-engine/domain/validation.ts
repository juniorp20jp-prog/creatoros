import type {
  CreatorDecision,
  CreatorDecisionInput,
  DecisionValidationIssue,
} from "./types";

function issue(
  field: string,
  code: string,
  message: string,
): DecisionValidationIssue {
  return { field, code, message };
}

function isIsoDate(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Date.parse(value));
}

function validateUnitInterval(
  field: string,
  value: number,
): ReadonlyArray<DecisionValidationIssue> {
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? []
    : [issue(field, "outside-unit-interval", `${field} must be between 0 and 1.`)];
}

export function validateCreatorDecisionInput(
  input: CreatorDecisionInput,
): ReadonlyArray<DecisionValidationIssue> {
  const issues: Array<DecisionValidationIssue> = [];

  if (input.creatorId.trim() === "") {
    issues.push(issue("creatorId", "required", "creatorId is required."));
  }
  if (!isIsoDate(input.context.analysisDate)) {
    issues.push(
      issue(
        "context.analysisDate",
        "invalid-date",
        "analysisDate must be a valid date.",
      ),
    );
  }
  if (
    !Number.isInteger(input.context.sampleSize) ||
    input.context.sampleSize < 0
  ) {
    issues.push(
      issue(
        "context.sampleSize",
        "invalid-sample-size",
        "sampleSize must be a non-negative integer.",
      ),
    );
  }
  issues.push(
    ...validateUnitInterval(
      "context.dataAvailability",
      input.context.dataAvailability,
    ),
  );

  const signalIds = new Set<string>();
  input.signals.forEach((signal, index) => {
    const prefix = `signals.${index}`;
    if (signal.id.trim() === "") {
      issues.push(issue(`${prefix}.id`, "required", "Signal id is required."));
    } else if (signalIds.has(signal.id)) {
      issues.push(
        issue(`${prefix}.id`, "duplicate", `Signal id ${signal.id} is duplicated.`),
      );
    }
    signalIds.add(signal.id);
    issues.push(...validateUnitInterval(`${prefix}.magnitude`, signal.magnitude));
    issues.push(
      ...validateUnitInterval(`${prefix}.confidenceHint`, signal.confidenceHint),
    );
    if (!isIsoDate(signal.observedAt)) {
      issues.push(
        issue(`${prefix}.observedAt`, "invalid-date", "observedAt is invalid."),
      );
    }
    if (
      signal.sampleSize !== null &&
      (!Number.isInteger(signal.sampleSize) || signal.sampleSize < 0)
    ) {
      issues.push(
        issue(
          `${prefix}.sampleSize`,
          "invalid-sample-size",
          "Signal sampleSize must be null or a non-negative integer.",
        ),
      );
    }
  });

  return issues;
}

export function validateCreatorDecision(
  decision: CreatorDecision,
): ReadonlyArray<DecisionValidationIssue> {
  const issues: Array<DecisionValidationIssue> = [];
  if (decision.id.trim() === "") {
    issues.push(issue("id", "required", "Decision id is required."));
  }
  if (decision.ruleId.trim() === "") {
    issues.push(issue("ruleId", "required", "Decision ruleId is required."));
  }
  if (!isIsoDate(decision.createdAt)) {
    issues.push(issue("createdAt", "invalid-date", "createdAt is invalid."));
  }
  if (decision.evidence.length === 0) {
    issues.push(
      issue("evidence", "required", "A decision must include evidence."),
    );
  }
  if (decision.metrics.length === 0) {
    issues.push(
      issue("metrics", "required", "A decision must include a metric."),
    );
  }
  issues.push(...validateUnitInterval("confidence.score", decision.confidence.score));
  issues.push(
    ...validateUnitInterval("prioritization.score", decision.prioritization.score),
    ...validateUnitInterval("prioritization.impact", decision.prioritization.impact),
    ...validateUnitInterval("prioritization.urgency", decision.prioritization.urgency),
    ...validateUnitInterval("prioritization.effort", decision.prioritization.effort),
    ...validateUnitInterval(
      "prioritization.strategicRelevance",
      decision.prioritization.strategicRelevance,
    ),
  );
  return issues;
}

