import type {
  AnalysisRun,
  AnalysisRunHistoryPage,
  AnalysisRunHistoryQuery,
  AnalysisRunStatus,
  CompleteAnalysisRunInput,
  CreateAnalysisRunInput,
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
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  complete(
    analysisRunId: string,
    input: CompleteAnalysisRunInput,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  fail(
    analysisRunId: string,
    input: FailAnalysisRunInput,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>>;

  listByChannel(
    query: AnalysisRunHistoryQuery,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRunHistoryPage>>;

  latestCompletedByChannel(
    channelId: string,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun | null>>;
}
