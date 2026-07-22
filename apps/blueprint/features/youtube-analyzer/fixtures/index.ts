import { completeAnalysisFixture } from "./complete-analysis.fixture";
import { insufficientSampleFixture } from "./insufficient-sample.fixture";
import { invalidAnalysisFixture } from "./invalid-analysis.fixture";
import { partialAnalysisFixture } from "./partial-analysis.fixture";

export const youtubeAnalyzerScenarioIds = [
  "complete",
  "partial",
  "insufficient",
  "invalid",
] as const;

export type YouTubeAnalyzerScenarioId =
  (typeof youtubeAnalyzerScenarioIds)[number];

export const youtubeAnalyzerScenarios = {
  complete: completeAnalysisFixture,
  partial: partialAnalysisFixture,
  insufficient: insufficientSampleFixture,
  invalid: invalidAnalysisFixture,
} as const;

export function isYouTubeAnalyzerScenarioId(
  value: string,
): value is YouTubeAnalyzerScenarioId {
  return youtubeAnalyzerScenarioIds.includes(
    value as YouTubeAnalyzerScenarioId,
  );
}
