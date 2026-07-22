import { interpretCreatorIntelligence } from "../../intelligence/creator-intelligence";
import type { YouTubeIntelligenceOutput } from "../../engines/youtube-intelligence";
import type { EngineExecutionResult } from "../../types";
import { adaptYouTubeIntelligenceToDecisionInput } from "./adapters/youtube-intelligence-adapter";
import { calculateDecisionConfidence } from "./confidence";
import type {
  DecisionEngine,
  DecisionPrioritizer,
  DecisionRule,
} from "./contracts";
import type {
  CreatorDecisionInput,
  DecisionGenerationResult,
  DecisionValidationIssue,
} from "./domain";
import {
  validateCreatorDecision,
  validateCreatorDecisionInput,
} from "./domain";
import {
  createPrioritizedDecision,
  StableDecisionPrioritizer,
} from "./prioritization";
import {
  highPerformingPatternRule,
  lowClickThroughRule,
  publishingInconsistencyRule,
  strongReachWeakRetentionRule,
} from "./rules";

export const CREATOR_DECISION_ENGINE_VERSION = "1.0.0" as const;

export const DEFAULT_CREATOR_DECISION_RULES: ReadonlyArray<DecisionRule> = [
  lowClickThroughRule,
  strongReachWeakRetentionRule,
  publishingInconsistencyRule,
  highPerformingPatternRule,
];

function failedResult(
  input: CreatorDecisionInput,
  issues: ReadonlyArray<DecisionValidationIssue>,
): DecisionGenerationResult {
  return {
    status: "failed",
    decisions: [],
    issues,
    metadata: {
      creatorId: input.creatorId,
      generatedAt: Number.isFinite(Date.parse(input.context.analysisDate))
        ? input.context.analysisDate
        : null,
    },
  };
}

export class CreatorDecisionEngine implements DecisionEngine {
  constructor(
    private readonly rules: ReadonlyArray<DecisionRule> =
      DEFAULT_CREATOR_DECISION_RULES,
    private readonly prioritizer: DecisionPrioritizer =
      new StableDecisionPrioritizer(),
  ) {}

  generateDecisions(input: CreatorDecisionInput): DecisionGenerationResult {
    const inputIssues = validateCreatorDecisionInput(input);
    if (inputIssues.length > 0) {
      return failedResult(input, inputIssues);
    }

    const candidates = this.rules
      .map((rule) => rule.evaluate(input))
      .filter((candidate) => candidate !== null);
    const deduplicationKeys = new Map(
      candidates.map((candidate) => [candidate.id, candidate.deduplicationKey]),
    );
    const decisions = candidates.map((candidate) =>
      createPrioritizedDecision(
        candidate,
        calculateDecisionConfidence(candidate, input),
      ),
    );
    const decisionIssues = decisions.flatMap((decision, index) =>
      validateCreatorDecision(decision).map((validationIssue) => ({
        ...validationIssue,
        field: `decisions.${index}.${validationIssue.field}`,
      })),
    );
    if (decisionIssues.length > 0) {
      return failedResult(input, decisionIssues);
    }

    return {
      status: "completed",
      decisions: this.prioritizer.prioritize(decisions, deduplicationKeys),
      metadata: {
        creatorId: input.creatorId,
        evaluatedRuleIds: this.rules.map((rule) => rule.id),
        generatedAt: input.context.analysisDate,
        signalCount: input.signals.length,
        insightCount: input.insights.length,
      },
    };
  }
}

export const creatorDecisionEngine = new CreatorDecisionEngine();

export function generateCreatorDecisions(
  input: CreatorDecisionInput,
): DecisionGenerationResult {
  return creatorDecisionEngine.generateDecisions(input);
}

export function generateCreatorDecisionsFromYouTubeAnalytics(
  analyticsResult: EngineExecutionResult<YouTubeIntelligenceOutput>,
): DecisionGenerationResult {
  const intelligenceResult = interpretCreatorIntelligence(analyticsResult);
  const adapted = adaptYouTubeIntelligenceToDecisionInput(
    analyticsResult,
    intelligenceResult,
  );
  if (adapted.status === "failed") {
    return {
      status: "failed",
      decisions: [],
      issues: [
        {
          field: "source",
          code: adapted.reason,
          message: adapted.errorCode,
        },
      ],
      metadata: {
        creatorId: "unknown",
        generatedAt: null,
      },
    };
  }
  return generateCreatorDecisions(adapted.input);
}
