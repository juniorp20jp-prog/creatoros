import type {
  ChannelDataAdapterMetadata,
  ChannelDataAdapterWarning,
} from "../../adapters";
import type { AnalysisResult } from "../../engines";

export const ANALYSIS_RUN_SCHEMA_VERSION = 2 as const;

export type AnalysisRunStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type AnalysisRunSourceMetadata = {
  sourceType: string;
  sourceSchemaVersion: string;
  sourceReference?: string;
};

export type AnalysisRunFailureStage =
  | "adapter"
  | "pipeline"
  | "persistence";

export type AnalysisRunFailure = {
  stage: AnalysisRunFailureStage;
  code: string;
  message: string;
};

export type AnalysisRun = {
  schemaVersion: typeof ANALYSIS_RUN_SCHEMA_VERSION;
  revision: number;
  analysisRunId: string;
  creatorId: string;
  channelId: string;
  status: AnalysisRunStatus;
  source: AnalysisRunSourceMetadata;
  adapterMetadata?: ChannelDataAdapterMetadata;
  adapterWarnings: ReadonlyArray<ChannelDataAdapterWarning>;
  pipelineVersion: string;
  analysisResult?: AnalysisResult;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failure?: AnalysisRunFailure;
  correlationId?: string;
  attempt: number;
  retryOfAnalysisRunId?: string;
};

export type CreateAnalysisRunInput = {
  schemaVersion: number;
  analysisRunId: string;
  creatorId: string;
  channelId: string;
  source: AnalysisRunSourceMetadata;
  pipelineVersion: string;
  correlationId?: string;
  attempt?: number;
  retryOfAnalysisRunId?: string;
};

export type CompleteAnalysisRunInput = {
  analysisResult: AnalysisResult;
  adapterMetadata: ChannelDataAdapterMetadata;
  adapterWarnings: ReadonlyArray<ChannelDataAdapterWarning>;
};

export type FailAnalysisRunInput = {
  failure: AnalysisRunFailure;
  adapterMetadata?: ChannelDataAdapterMetadata;
  adapterWarnings?: ReadonlyArray<ChannelDataAdapterWarning>;
};

export type AnalysisRunMutationOptions = {
  expectedRevision?: number;
};

export type DeleteManyAnalysisRunsInput = {
  analysisRunIds: ReadonlyArray<string>;
  expectedRevisions?: Readonly<Record<string, number>>;
};

export type AnalysisRunHistoryQuery = {
  channelId: string;
  limit?: number;
  cursor?: string;
  status?: AnalysisRunStatus;
};

export type AnalysisRunHistoryPage = {
  items: ReadonlyArray<AnalysisRun>;
  nextCursor: string | null;
};
