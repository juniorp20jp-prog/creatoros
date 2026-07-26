import type { DecisionGenerationResult } from "../../decisions";
import type {
  YouTubeIntelligenceInput,
  YouTubeIntelligenceOutput,
} from "../../engines";
import type { CreatorIntelligenceResult } from "../../intelligence";
import type { EngineExecutionResult } from "../../types";

export const CREATOR_ANALYSIS_RUN_SCHEMA_VERSION = 1 as const;

export type CreatorAnalysisRunStatus = EngineExecutionResult<unknown>["status"];

export type CreatorAnalysisChannelIdentity = {
  id: string;
  name: string;
};

export type CreatorAnalysisRunSource = {
  platform: "youtube";
  channel: CreatorAnalysisChannelIdentity;
  referenceChannel: CreatorAnalysisChannelIdentity | null;
};

export type CreatorAnalysisRunMetadata = {
  engineId: string;
  executionId: string;
  correlationId: string | null;
  attributes: Readonly<Record<string, string>>;
};

export type CreatorAnalysisRunSnapshots = {
  input: YouTubeIntelligenceInput;
  analysis: EngineExecutionResult<YouTubeIntelligenceOutput>;
  intelligence: CreatorIntelligenceResult | null;
  decisions: DecisionGenerationResult | null;
};

/**
 * Application aggregate for one deterministic CreatorOS analysis execution.
 * It references the existing analytics, intelligence, and decision contracts
 * instead of redefining their domain structures.
 */
export type CreatorAnalysisRun = {
  id: string;
  status: CreatorAnalysisRunStatus;
  createdAt: string;
  updatedAt: string;
  locale: string;
  source: CreatorAnalysisRunSource;
  snapshots: CreatorAnalysisRunSnapshots;
  metadata: CreatorAnalysisRunMetadata;
};

export type CreatorAnalysisRunRecordV1 = CreatorAnalysisRun & {
  schemaVersion: typeof CREATOR_ANALYSIS_RUN_SCHEMA_VERSION;
};

export type CreatorAnalysisRunRecord = CreatorAnalysisRunRecordV1;

export type CreatorAnalysisRunParseResult =
  | { status: "valid"; record: CreatorAnalysisRunRecord }
  | {
      status: "invalid";
      error: import("./errors").CreatorAnalysisRunPersistenceError;
    };

export type CreatorAnalysisRunDeserializationResult =
  | { status: "success"; run: CreatorAnalysisRun }
  | {
      status: "failure";
      error: import("./errors").CreatorAnalysisRunPersistenceError;
    };
