import type {
  AnalysisResult,
} from "../../engines";
import type {
  AnalysisRunFailureStage,
} from "../../persistence";

export type AnalysisReadStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partial"
  | "failed";

export type AnalysisSummary = {
  analysisRunId: string;
  analysisId: string | null;
  creatorId: string;
  channelId: string;
  status: AnalysisReadStatus;
  attempt: number;
  retryOfAnalysisRunId: string | null;
  warningCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type AnalysisHistoryItem = {
  analysisRunId: string;
  analysisId: string | null;
  status: AnalysisReadStatus;
  attempt: number;
  retryOfAnalysisRunId: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AnalysisReadFailure = {
  stage: AnalysisRunFailureStage;
  code: string;
  message: string;
};

export type AnalysisReadSource = {
  sourceType: string;
  sourceSchemaVersion: string;
  sourceReference: string | null;
};

export type AnalysisDetails = {
  summary: AnalysisSummary;
  source: AnalysisReadSource;
  pipelineVersion: string;
  correlationId: string | null;
  analysisResult: AnalysisResult | null;
  failure: AnalysisReadFailure | null;
};

export type AnalysisStatusCounts = {
  pending: number;
  processing: number;
  completed: number;
  partial: number;
  failed: number;
};

export type AnalysisStatusSummary = {
  channelId: string;
  total: number;
  counts: AnalysisStatusCounts;
  queriedAt: string;
};

export type CursorResult = {
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type PaginationResult<TItem> = {
  items: ReadonlyArray<TItem>;
  pageSize: number;
  cursor: CursorResult;
  queriedAt: string;
};

export type AnalysisHistory = {
  rootAnalysisRunId: string;
  requestedAnalysisRunId: string;
  channelId: string;
  items: ReadonlyArray<AnalysisHistoryItem>;
  queriedAt: string;
};
