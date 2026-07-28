export type AnalysisRunRepositoryErrorCode =
  | "duplicate-id"
  | "not-found"
  | "invalid-transition"
  | "concurrency-conflict"
  | "version-incompatibility"
  | "persistence-failure"
  | "invalid-query";

export type AnalysisRunRepositoryError = {
  code: AnalysisRunRepositoryErrorCode;
  message: string;
  analysisRunId?: string;
  expectedRevision?: number;
  actualRevision?: number;
};

export type AnalysisRunRepositoryResult<TValue> =
  | {
      status: "success";
      value: TValue;
    }
  | {
      status: "failure";
      error: AnalysisRunRepositoryError;
    };
