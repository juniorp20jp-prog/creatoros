export type AnalysisRunRepositoryErrorCode =
  | "duplicate-id"
  | "not-found"
  | "invalid-transition"
  | "version-incompatibility"
  | "persistence-failure"
  | "invalid-query";

export type AnalysisRunRepositoryError = {
  code: AnalysisRunRepositoryErrorCode;
  message: string;
  analysisRunId?: string;
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
