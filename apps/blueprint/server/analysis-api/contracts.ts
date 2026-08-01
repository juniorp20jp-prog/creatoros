import type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisQueryResult,
  AnalysisReadStatus,
  AnalysisServiceExecution,
  AnalysisServiceResult,
  AnalysisStatusSummary,
  AnalysisSummary,
  Clock,
  IdGenerator,
  ListAnalysisRunsQuery,
  PaginationResult,
  ReplayAnalysisInput,
  ReplayedAnalysisServiceExecution,
  RunAnalysisInput,
} from "../../core";

export const INTERNAL_ANALYSIS_API_VERSION = "v1" as const;
export const INTERNAL_ANALYSIS_API_PREFIX =
  "/api/internal/v1" as const;

export type InternalAnalysisApiMeta = {
  apiVersion: typeof INTERNAL_ANALYSIS_API_VERSION;
  requestId: string;
  timestamp: string;
};

export type InternalAnalysisApiSuccess<TData> = {
  data: TData;
  meta: InternalAnalysisApiMeta;
};

export type InternalAnalysisApiErrorCode =
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "FIXTURE_NOT_FOUND"
  | "FIXTURE_IDENTITY_MISMATCH"
  | "ANALYSIS_NOT_FOUND"
  | "DUPLICATE_ANALYSIS_RUN_ID"
  | "CONCURRENCY_CONFLICT"
  | "ANALYSIS_ADAPTER_FAILED"
  | "ANALYSIS_PIPELINE_FAILED"
  | "ANALYSIS_PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

export type InternalAnalysisApiValidationDetail = {
  path: string;
  code: string;
  message: string;
};

export type InternalAnalysisApiError = {
  code: InternalAnalysisApiErrorCode;
  message: string;
  details: ReadonlyArray<InternalAnalysisApiValidationDetail>;
};

export type InternalAnalysisApiFailure = {
  error: InternalAnalysisApiError;
  meta: InternalAnalysisApiMeta;
};

export type RunAnalysisRequest = {
  fixtureId: string;
  creatorId: string;
  channelId: string;
  correlationId?: string;
  analysisRunId?: string;
};

export type ReplayAnalysisRequest = {
  fixtureId: string;
  correlationId?: string;
  newAnalysisRunId?: string;
};

export type RunAnalysisResponse = {
  analysisRunId: string;
  analysis: AnalysisDetails;
};

export type ReplayAnalysisResponse = RunAnalysisResponse & {
  replayedFromAnalysisRunId: string;
};

export type DeleteAnalysisResponse = {
  analysisRunId: string;
  deleted: true;
  revision: number;
};

export type ListAnalysisRunsRequest = {
  channelId: string;
  creatorId?: string;
  status?: AnalysisReadStatus;
  from?: string;
  to?: string;
  attempt?: number;
  analysisId?: string;
  cursor?: string;
  limit?: number;
};

export type StatusSummaryRequest = Omit<
  ListAnalysisRunsRequest,
  "cursor" | "limit"
>;

export type DeleteAnalysisRequest = {
  expectedRevision?: number;
};

export type AnalysisFixture = {
  fixtureId: string;
  creatorId: string;
  channelId: string;
  sourceData: unknown;
};

export interface AnalysisFixtureCatalog {
  get(fixtureId: string): AnalysisFixture | undefined;
  listIds(): ReadonlyArray<string>;
}

export interface AnalysisApplicationService {
  runAnalysis(
    input: RunAnalysisInput<unknown>,
  ): Promise<AnalysisServiceResult<AnalysisServiceExecution>>;
  replayAnalysis(
    input: ReplayAnalysisInput<unknown>,
  ): Promise<
    AnalysisServiceResult<ReplayedAnalysisServiceExecution>
  >;
  deleteAnalysis(
    analysisRunId: string,
    options?: { expectedRevision?: number },
  ): Promise<AnalysisServiceResult<{ analysisRunId: string; revision: number }>>;
}

export interface AnalysisReadService {
  getAnalysisById(
    analysisRunId: string,
  ): Promise<AnalysisQueryResult<AnalysisDetails>>;
  listAnalysisRuns(
    query: ListAnalysisRunsQuery,
  ): Promise<
    AnalysisQueryResult<PaginationResult<AnalysisSummary>>
  >;
  getAnalysisHistory(input: {
    analysisRunId: string;
  }): Promise<AnalysisQueryResult<AnalysisHistory>>;
  summarizeAnalysisRuns(input: {
    filters: ListAnalysisRunsQuery["filters"];
  }): Promise<AnalysisQueryResult<AnalysisStatusSummary>>;
}

export type InternalAnalysisApiDependencies = {
  analysisService: AnalysisApplicationService;
  analysisQueryService: AnalysisReadService;
  fixtureCatalog: AnalysisFixtureCatalog;
  clock: Clock;
  requestIdGenerator: IdGenerator;
};

export type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisReadStatus,
  AnalysisStatusSummary,
  AnalysisSummary,
  PaginationResult,
} from "../../core";
