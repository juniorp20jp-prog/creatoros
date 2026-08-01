import type {
  AnalysisRunRepositoryError,
} from "../../persistence";
import type {
  AnalysisReadStatus,
} from "./read-models";

export const DEFAULT_ANALYSIS_QUERY_PAGE_SIZE = 20;
export const MAX_ANALYSIS_QUERY_PAGE_SIZE = 100;

export type AnalysisQueryOperation =
  | "get-analysis-by-id"
  | "list-analysis-runs"
  | "list-latest-analysis"
  | "get-analysis-history"
  | "analysis-exists"
  | "count-analysis-runs"
  | "summarize-analysis-runs";

export type AnalysisQueryErrorCode =
  | "invalid-query"
  | "invalid-cursor"
  | "not-found"
  | "repository-failure"
  | "query-failure";

export type AnalysisQueryError = {
  code: AnalysisQueryErrorCode;
  operation: AnalysisQueryOperation;
  message: string;
  causeCode: string;
  analysisRunId?: string;
};

export type AnalysisQueryResult<TValue> =
  | {
      status: "success";
      value: TValue;
    }
  | {
      status: "failure";
      error: AnalysisQueryError;
    };

export type AnalysisQueryFilters = {
  channelId: string;
  status?: AnalysisReadStatus;
  creatorId?: string;
  createdFrom?: string;
  createdTo?: string;
  attempt?: number;
  analysisId?: string;
};

export type ListAnalysisRunsQuery = {
  filters: AnalysisQueryFilters;
  pageSize?: number;
  cursor?: string;
};

export type AnalysisScopedListQuery = {
  filters: Omit<AnalysisQueryFilters, "status">;
  pageSize?: number;
  cursor?: string;
};

export type GetAnalysisHistoryQuery = {
  analysisRunId: string;
};

export type AnalysisCountQuery = {
  filters: AnalysisQueryFilters;
};

export type AnalysisQueryCursorPayload = {
  version: 1;
  repositoryCursor: string;
  filterSignature: string;
};

export type AnalysisQueryRepositoryFailure = {
  error: AnalysisRunRepositoryError;
};
