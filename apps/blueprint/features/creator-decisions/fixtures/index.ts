import {
  isYouTubeAnalyzerScenarioId,
  youtubeAnalyzerScenarios,
  type YouTubeAnalyzerScenarioId,
} from "../../youtube-analyzer/fixtures";
import { noDecisionsFixture } from "./no-decisions.fixture";

export const creatorDecisionScenarioIds = [
  "complete",
  "partial",
  "insufficient",
  "no-decisions",
  "invalid",
] as const;

export type CreatorDecisionScenarioId =
  (typeof creatorDecisionScenarioIds)[number];

export const creatorDecisionScenarios = {
  ...youtubeAnalyzerScenarios,
  "no-decisions": noDecisionsFixture,
} as const;

export function isCreatorDecisionScenarioId(
  value: string,
): value is CreatorDecisionScenarioId {
  return value === "no-decisions" || isYouTubeAnalyzerScenarioId(value);
}

export function isSharedAnalyzerScenarioId(
  value: CreatorDecisionScenarioId,
): value is YouTubeAnalyzerScenarioId {
  return value !== "no-decisions";
}

