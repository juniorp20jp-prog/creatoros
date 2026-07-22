import type {
  CreatorInsight,
  EvidenceBlock,
  ExecutiveBrief,
  IntelligenceAnalysisContext,
  IntelligenceLimitation,
  IntelligenceQuality,
} from "../../../core";
import type { YouTubeAnalyzerScenarioId } from "../../youtube-analyzer";

export type CreatorIntelligenceUiState =
  | "success"
  | "partial-data"
  | "insufficient-sample"
  | "validation-error"
  | "unexpected-error"
  | "empty"
  | "loading";

export type CreatorIntelligenceSuccessViewModel = {
  state: "success" | "partial-data" | "insufficient-sample";
  scenarioId: YouTubeAnalyzerScenarioId;
  brief: ExecutiveBrief;
  priorityInsights: ReadonlyArray<CreatorInsight>;
  additionalInsights: ReadonlyArray<CreatorInsight>;
  evidence: ReadonlyArray<EvidenceBlock>;
  context: IntelligenceAnalysisContext;
  quality: IntelligenceQuality;
  limitations: ReadonlyArray<IntelligenceLimitation>;
  hasInsights: boolean;
};

export type CreatorIntelligenceErrorViewModel = {
  state: "validation-error" | "unexpected-error";
  scenarioId: YouTubeAnalyzerScenarioId;
  errorCode: string;
  failureReason: string;
};

export type CreatorIntelligenceViewModel =
  | CreatorIntelligenceSuccessViewModel
  | CreatorIntelligenceErrorViewModel;
