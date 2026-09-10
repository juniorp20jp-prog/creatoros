import type { DecisionGenerationResult } from "../../decisions";
import type { YouTubeDataQuality, YouTubeIntelligenceOutput } from "../../engines/youtube-intelligence";
import type { CreatorIntelligenceResult } from "../creator-intelligence";

export const STRATEGIC_ANALYSIS_PROJECTION_VERSION = 1 as const;

export type StrategicAnalysisProvenance = Readonly<{
  analysisId: string;
  sourceType: "connected-youtube";
  sourceReference?: string;
  capturedAt: string;
}>;

export type StrategicAnalysisProjection = Readonly<{
  schemaVersion: typeof STRATEGIC_ANALYSIS_PROJECTION_VERSION;
  generatedAt: string;
  provenance: StrategicAnalysisProvenance;
  versions: Readonly<{
    sourceEngine: string;
    creatorInterpreter: string;
    decisionEngine: string;
  }>;
  sourceIntelligence: Readonly<{
    provider: "youtube";
    engineId: "youtube-intelligence";
    executionId: string;
    output: YouTubeIntelligenceOutput;
  }>;
  creatorIntelligence: CreatorIntelligenceResult;
  decisions: DecisionGenerationResult;
  dataQuality: YouTubeDataQuality;
  limitations: ReadonlyArray<string>;
}>;

export type StrategicProjectionAvailability =
  | { status: "ready"; projection: StrategicAnalysisProjection }
  | { status: "requires-reanalysis"; reason: "missing" | "incompatible-version" };

export function resolveStrategicProjection(
  projection: StrategicAnalysisProjection | undefined,
): StrategicProjectionAvailability {
  if (projection === undefined) {
    return { status: "requires-reanalysis", reason: "missing" };
  }
  if (projection.schemaVersion !== STRATEGIC_ANALYSIS_PROJECTION_VERSION) {
    return { status: "requires-reanalysis", reason: "incompatible-version" };
  }
  return { status: "ready", projection };
}