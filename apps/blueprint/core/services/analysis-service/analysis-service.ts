import type {
  AnalysisRun,
  AnalysisRunRepository,
  AnalysisRunRepositoryError,
  PersistedAnalysisExecutionResult,
} from "../../persistence";
import type {
  AnalysisHistoryPage,
  AnalysisHistoryQuery,
  AnalysisRunExecutor,
  AnalysisServiceError,
  AnalysisServiceExecution,
  AnalysisServiceOperation,
  AnalysisServiceResult,
  DeleteAnalysisOptions,
  ReplayAnalysisInput,
  ReplayedAnalysisServiceExecution,
  RunAnalysisInput,
} from "./contracts";

const UNEXPECTED_DEPENDENCY_FAILURE =
  "UNEXPECTED_DEPENDENCY_FAILURE";

export class AnalysisService<TSource> {
  constructor(
    private readonly executor: AnalysisRunExecutor<TSource>,
    private readonly repository: AnalysisRunRepository,
  ) {}

  async runAnalysis(
    input: RunAnalysisInput<TSource>,
  ): Promise<AnalysisServiceResult<AnalysisServiceExecution>> {
    const validationError = this.validateRunInput(
      input,
      "run-analysis",
    );
    if (validationError) {
      return this.failure(validationError);
    }

    try {
      const result = await this.executor.execute(input);
      return this.mapExecution(result, "run-analysis");
    } catch {
      return this.unexpectedFailure(
        "run-analysis",
        input.analysisRunId,
      );
    }
  }

  async getAnalysis(
    analysisRunId: string,
  ): Promise<AnalysisServiceResult<AnalysisRun>> {
    const validationError = this.validateIdentifier(
      analysisRunId,
      "get-analysis",
    );
    if (validationError) {
      return this.failure(validationError);
    }

    try {
      const result = await this.repository.getById(
        analysisRunId,
      );
      return result.status === "success"
        ? this.success(result.value)
        : this.repositoryFailure(
            "get-analysis",
            result.error,
            analysisRunId,
          );
    } catch {
      return this.unexpectedFailure(
        "get-analysis",
        analysisRunId,
      );
    }
  }

  async listAnalysisRuns(
    query: AnalysisHistoryQuery,
  ): Promise<AnalysisServiceResult<AnalysisHistoryPage>> {
    const validationError = this.validateIdentifier(
      query.channelId,
      "list-analysis-runs",
    );
    if (validationError) {
      return this.failure(validationError);
    }

    try {
      const result = await this.repository.listByChannel(query);
      return result.status === "success"
        ? this.success(result.value)
        : this.repositoryFailure(
            "list-analysis-runs",
            result.error,
          );
    } catch {
      return this.unexpectedFailure(
        "list-analysis-runs",
      );
    }
  }

  async deleteAnalysis(
    analysisRunId: string,
    options?: DeleteAnalysisOptions,
  ): Promise<AnalysisServiceResult<AnalysisRun>> {
    const validationError = this.validateIdentifier(
      analysisRunId,
      "delete-analysis",
    );
    if (validationError) {
      return this.failure(validationError);
    }

    try {
      const result = await this.repository.deleteById(
        analysisRunId,
        options,
      );
      return result.status === "success"
        ? this.success(result.value)
        : this.repositoryFailure(
            "delete-analysis",
            result.error,
            analysisRunId,
          );
    } catch {
      return this.unexpectedFailure(
        "delete-analysis",
        analysisRunId,
      );
    }
  }

  async replayAnalysis(
    input: ReplayAnalysisInput<TSource>,
  ): Promise<
    AnalysisServiceResult<ReplayedAnalysisServiceExecution>
  > {
    const validationError = this.validateIdentifier(
      input.analysisRunId,
      "replay-analysis",
    );
    if (validationError) {
      return this.failure(validationError);
    }
    if (
      input.newAnalysisRunId !== undefined &&
      input.newAnalysisRunId.trim().length === 0
    ) {
      return this.failure(
        this.validationFailure(
          "replay-analysis",
          "newAnalysisRunId must be a non-empty identifier when provided.",
          input.analysisRunId,
        ),
      );
    }

    let original: AnalysisRun;
    try {
      const existing = await this.repository.getById(
        input.analysisRunId,
      );
      if (existing.status === "failure") {
        return this.repositoryFailure(
          "replay-analysis",
          existing.error,
          input.analysisRunId,
        );
      }
      original = existing.value;
    } catch {
      return this.unexpectedFailure(
        "replay-analysis",
        input.analysisRunId,
      );
    }

    try {
      const replayed = await this.executor.execute({
        sourceData: input.sourceData,
        creatorId: original.creatorId,
        channelId: original.channelId,
        ...(input.newAnalysisRunId
          ? { analysisRunId: input.newAnalysisRunId }
          : {}),
        correlationId:
          input.correlationId ??
          original.correlationId,
        sourceReference:
          input.sourceReference ??
          original.source.sourceReference,
        attempt: original.attempt + 1,
        retryOfAnalysisRunId: original.analysisRunId,
      });
      const mapped = this.mapExecution(
        replayed,
        "replay-analysis",
        original.analysisRunId,
      );
      if (mapped.status === "failure") {
        return mapped;
      }
      return this.success({
        ...mapped.value,
        replayedFromAnalysisRunId:
          original.analysisRunId,
      });
    } catch {
      return this.unexpectedFailure(
        "replay-analysis",
        input.newAnalysisRunId,
        input.analysisRunId,
      );
    }
  }

  private mapExecution(
    result: PersistedAnalysisExecutionResult,
    operation: "run-analysis" | "replay-analysis",
    relatedAnalysisRunId?: string,
  ): AnalysisServiceResult<AnalysisServiceExecution> {
    if (result.status === "failed") {
      const code =
        result.stage === "adapter"
          ? "adapter-failure"
          : result.stage === "pipeline"
            ? "pipeline-failure"
            : result.error.code === "concurrency-conflict"
              ? "concurrency-conflict"
              : "persistence-failure";
      return this.failure({
        code,
        operation,
        message: result.error.message,
        causeCode: result.error.code,
        stage: result.stage,
        analysisRunId: result.analysisRunId,
        ...(relatedAnalysisRunId
          ? { relatedAnalysisRunId }
          : {}),
        ...(result.run
          ? { persistedRun: result.run }
          : {}),
      });
    }

    if (!result.run.analysisResult) {
      return this.failure({
        code: "repository-failure",
        operation,
        message:
          "Completed analysis run does not contain an AnalysisResult.",
        causeCode: "MISSING_ANALYSIS_RESULT",
        stage: "persistence",
        analysisRunId: result.analysisRunId,
        ...(relatedAnalysisRunId
          ? { relatedAnalysisRunId }
          : {}),
        persistedRun: result.run,
      });
    }

    return this.success({
      analysisRunId: result.analysisRunId,
      adapterStatus: result.adapterStatus,
      analysisResult: result.run.analysisResult,
      run: result.run,
    });
  }

  private repositoryFailure<TValue>(
    operation: AnalysisServiceOperation,
    error: AnalysisRunRepositoryError,
    analysisRunId?: string,
  ): AnalysisServiceResult<TValue> {
    const code =
      error.code === "concurrency-conflict"
        ? "concurrency-conflict"
        : error.code === "not-found"
          ? "not-found"
          : error.code === "invalid-query"
            ? "validation-failure"
            : "repository-failure";
    return this.failure({
      code,
      operation,
      message: error.message,
      causeCode: error.code,
      analysisRunId:
        error.analysisRunId ?? analysisRunId,
      expectedRevision: error.expectedRevision,
      actualRevision: error.actualRevision,
    });
  }

  private unexpectedFailure<TValue>(
    operation: AnalysisServiceOperation,
    analysisRunId?: string,
    relatedAnalysisRunId?: string,
  ): AnalysisServiceResult<TValue> {
    return this.failure({
      code: "repository-failure",
      operation,
      message:
        "An injected analysis dependency failed unexpectedly.",
      causeCode: UNEXPECTED_DEPENDENCY_FAILURE,
      analysisRunId,
      relatedAnalysisRunId,
    });
  }

  private validateRunInput(
    input: RunAnalysisInput<TSource>,
    operation: "run-analysis",
  ): AnalysisServiceError | undefined {
    if (input.creatorId.trim().length === 0) {
      return this.validationFailure(
        operation,
        "creatorId must be a non-empty identifier.",
        input.analysisRunId,
      );
    }
    if (input.channelId.trim().length === 0) {
      return this.validationFailure(
        operation,
        "channelId must be a non-empty identifier.",
        input.analysisRunId,
      );
    }
    if (
      input.analysisRunId !== undefined &&
      input.analysisRunId.trim().length === 0
    ) {
      return this.validationFailure(
        operation,
        "analysisRunId must be a non-empty identifier when provided.",
      );
    }
    return undefined;
  }

  private validateIdentifier(
    value: string,
    operation: AnalysisServiceOperation,
  ): AnalysisServiceError | undefined {
    return value.trim().length === 0
      ? this.validationFailure(
          operation,
          "analysis identifier must be non-empty.",
        )
      : undefined;
  }

  private validationFailure(
    operation: AnalysisServiceOperation,
    message: string,
    analysisRunId?: string,
  ): AnalysisServiceError {
    return {
      code: "validation-failure",
      operation,
      message,
      causeCode: "INVALID_SERVICE_INPUT",
      analysisRunId,
    };
  }

  private success<TValue>(
    value: TValue,
  ): AnalysisServiceResult<TValue> {
    return { status: "success", value };
  }

  private failure<TValue>(
    error: AnalysisServiceError,
  ): AnalysisServiceResult<TValue> {
    return { status: "failure", error };
  }
}
