import type {
  AnalysisRun,
} from "../../persistence";
import type {
  AnalysisDetails,
  AnalysisHistoryItem,
  AnalysisReadStatus,
  AnalysisSummary,
} from "./read-models";

export function resolveAnalysisReadStatus(
  run: AnalysisRun,
): AnalysisReadStatus {
  if (
    run.status === "completed" &&
    run.adapterWarnings.length > 0
  ) {
    return "partial";
  }
  return run.status;
}

export function mapAnalysisRunToSummary(
  run: AnalysisRun,
): AnalysisSummary {
  return {
    analysisRunId: run.analysisRunId,
    analysisId: run.analysisResult?.analysisId ?? null,
    creatorId: run.creatorId,
    channelId: run.channelId,
    status: resolveAnalysisReadStatus(run),
    attempt: run.attempt,
    retryOfAnalysisRunId:
      run.retryOfAnalysisRunId ?? null,
    warningCount: run.adapterWarnings.length,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt ?? null,
  };
}

export function mapAnalysisRunToHistoryItem(
  run: AnalysisRun,
): AnalysisHistoryItem {
  const summary = mapAnalysisRunToSummary(run);
  return {
    analysisRunId: summary.analysisRunId,
    analysisId: summary.analysisId,
    status: summary.status,
    attempt: summary.attempt,
    retryOfAnalysisRunId:
      summary.retryOfAnalysisRunId,
    createdAt: summary.createdAt,
    completedAt: summary.completedAt,
  };
}

export function mapAnalysisRunToDetails(
  run: AnalysisRun,
): AnalysisDetails {
  return {
    summary: mapAnalysisRunToSummary(run),
    source: {
      sourceType: run.source.sourceType,
      sourceSchemaVersion:
        run.source.sourceSchemaVersion,
      sourceReference:
        run.source.sourceReference ?? null,
    },
    pipelineVersion: run.pipelineVersion,
    correlationId: run.correlationId ?? null,
    analysisResult: run.analysisResult
      ? structuredClone(run.analysisResult)
      : null,
    failure: run.failure
      ? {
          stage: run.failure.stage,
          code: run.failure.code,
          message: run.failure.message,
        }
      : null,
  };
}
