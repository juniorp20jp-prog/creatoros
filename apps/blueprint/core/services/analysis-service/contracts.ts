import type { AnalysisResult } from "../../engines";
import type {
  AnalysisRun,
  AnalysisRunFailureStage,
  AnalysisRunHistoryPage,
  AnalysisRunHistoryQuery,
  AnalysisRunMutationOptions,
  ExecutePersistedAnalysisInput,
  PersistedAnalysisExecutionResult,
} from "../../persistence";

export type AnalysisServiceOperation =
  | "run-analysis"
  | "get-analysis"
  | "list-analysis-runs"
  | "delete-analysis"
  | "replay-analysis";

export type AnalysisServiceErrorCode =
  | "validation-failure"
  | "adapter-failure"
  | "pipeline-failure"
  | "persistence-failure"
  | "repository-failure"
  | "concurrency-conflict"
  | "not-found";

export type AnalysisServiceError = {
  code: AnalysisServiceErrorCode;
  operation: AnalysisServiceOperation;
  message: string;
  causeCode: string;
  stage?: AnalysisRunFailureStage;
  analysisRunId?: string;
  relatedAnalysisRunId?: string;
  expectedRevision?: number;
  actualRevision?: number;
  persistedRun?: AnalysisRun;
};

export type AnalysisServiceResult<TValue> =
  | {
      status: "success";
      value: TValue;
    }
  | {
      status: "failure";
      error: AnalysisServiceError;
    };

export type RunAnalysisInput<TSource> =
  ExecutePersistedAnalysisInput<TSource>;

export type AnalysisServiceExecution = {
  analysisRunId: string;
  adapterStatus: "success" | "partial";
  analysisResult: AnalysisResult;
  run: AnalysisRun;
};

export type ReplayAnalysisInput<TSource> = {
  analysisRunId: string;
  sourceData: TSource;
  newAnalysisRunId?: string;
  correlationId?: string;
  sourceReference?: string;
};

export type ReplayedAnalysisServiceExecution =
  AnalysisServiceExecution & {
    replayedFromAnalysisRunId: string;
  };

export type DeleteAnalysisOptions =
  AnalysisRunMutationOptions;

export type AnalysisHistoryQuery =
  AnalysisRunHistoryQuery;

export type AnalysisHistoryPage =
  AnalysisRunHistoryPage;

export interface AnalysisRunExecutor<TSource> {
  execute(
    input: ExecutePersistedAnalysisInput<TSource>,
  ): Promise<PersistedAnalysisExecutionResult>;
}
