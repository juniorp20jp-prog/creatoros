import type {
  CreatorContext,
  CreatorObjective,
} from "../../domain/creator";
import type {
  IntelligenceRecommendation,
  IntelligenceSignal,
  IntelligenceSource,
} from "../../domain/intelligence";
import type {
  AnalysisResult,
  RawChannelData,
} from "./domain-models";

export const CREATOR_INTELLIGENCE_ENGINE_ID =
  "creator-intelligence" as const;

export type CreatorIntelligenceEngineId =
  typeof CREATOR_INTELLIGENCE_ENGINE_ID;

export type CreatorIntelligenceInput = {
  creator: CreatorContext;
  objective?: CreatorObjective;
  sources: ReadonlyArray<IntelligenceSource>;
  rawChannelData?: RawChannelData;
};

export type CreatorIntelligenceReadiness =
  | "awaiting-sources"
  | "ready-for-providers"
  | "analysis-completed";

export type CreatorIntelligenceOutput = {
  creator: CreatorContext;
  objective?: CreatorObjective;
  creatorId: string;
  readiness: CreatorIntelligenceReadiness;
  signals: ReadonlyArray<IntelligenceSignal>;
  recommendations: ReadonlyArray<IntelligenceRecommendation>;
  analysis?: AnalysisResult;
};

export type CreatorIntelligencePipelineState = {
  input: CreatorIntelligenceInput;
  signals: ReadonlyArray<IntelligenceSignal>;
  recommendations: ReadonlyArray<IntelligenceRecommendation>;
};
