import type { CreatorIntelligenceResult } from "../../../core";
import type { YouTubeAnalyzerScenarioId } from "../../youtube-analyzer";
import type {
  CreatorIntelligenceSuccessViewModel,
  CreatorIntelligenceViewModel,
} from "./creator-intelligence-view-model.types";

function successfulState(
  result: Extract<CreatorIntelligenceResult, { status: "success" }>,
): CreatorIntelligenceSuccessViewModel["state"] {
  if (result.quality.status === "limited") {
    return "insufficient-sample";
  }
  if (result.quality.status === "partial") {
    return "partial-data";
  }
  return "success";
}

export function createCreatorIntelligenceViewModel(
  scenarioId: YouTubeAnalyzerScenarioId,
  result: CreatorIntelligenceResult,
): CreatorIntelligenceViewModel {
  if (result.status === "failure") {
    return {
      state:
        result.reason === "invalid-analytics-result"
          ? "validation-error"
          : "unexpected-error",
      scenarioId,
      errorCode: result.errorCode,
      failureReason: result.reason,
    };
  }

  const priorityInsights = result.insights.filter(
    (insight) => insight.priority === "high",
  );
  const additionalInsights = result.insights.filter(
    (insight) => insight.priority !== "high",
  );

  return {
    state: successfulState(result),
    scenarioId,
    brief: result.brief,
    priorityInsights,
    additionalInsights,
    evidence: result.evidence,
    context: result.context,
    quality: result.quality,
    limitations: result.limitations,
    hasInsights: result.insights.length > 0,
  };
}
