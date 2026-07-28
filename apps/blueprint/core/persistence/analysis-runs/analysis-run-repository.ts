import type {
  AnalysisRun,
  AnalysisRunHistoryPage,
  AnalysisRunHistoryQuery,
  AnalysisRunMutationOptions,
  AnalysisRunStatus,
  CompleteAnalysisRunInput,
  CreateAnalysisRunInput,
  DeleteManyAnalysisRunsInput,
  FailAnalysisRunInput,
} from "./analysis-run-model";
import type {
  AnalysisRunRepositoryResult,
} from "./analysis-run-repository-error";

export interface AnalysisRunRepository {
  create(
    input: CreateAnalysisRunInput,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  getById(
    analysisRunId: string,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  updateStatus(
    analysisRunId: string,
    status: AnalysisRunStatus,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  complete(
    analysisRunId: string,
    input: CompleteAnalysisRunInput,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  fail(
    analysisRunId: string,
    input: FailAnalysisRunInput,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  listByChannel(
    query: AnalysisRunHistoryQuery,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRunHistoryPage>>;

  latestCompletedByChannel(
    channelId: string,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun | null>>;

  deleteById(
    analysisRunId: string,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  deleteMany(
    input: DeleteManyAnalysisRunsInput,
  ): Promise<
    AnalysisRunRepositoryResult<ReadonlyArray<AnalysisRun>>
  >;
}
