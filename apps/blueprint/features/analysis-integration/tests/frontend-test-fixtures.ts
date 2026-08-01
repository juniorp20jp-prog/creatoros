import type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisStatusSummary,
  AnalysisSummary,
  PaginationResult,
} from "../../../server/analysis-api/contracts";

export const TEST_TIMESTAMP = "2026-08-01T12:00:00.000Z";

export const analysisSummary: AnalysisSummary = {
  analysisRunId: "analysis_run_frontend",
  analysisId: "analysis_frontend",
  creatorId: "creator_fixture_complete",
  channelId: "channel_fixture_complete",
  status: "completed",
  attempt: 1,
  retryOfAnalysisRunId: null,
  warningCount: 0,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  completedAt: TEST_TIMESTAMP,
};

export const analysisDetails: AnalysisDetails = {
  summary: analysisSummary,
  source: {
    sourceType: "local-fixture",
    sourceSchemaVersion: "1",
    sourceReference: "fixture:complete",
  },
  pipelineVersion: "1.0.0",
  correlationId: "correlation_frontend",
  analysisResult: null,
  failure: null,
};

export const analysisPage: PaginationResult<AnalysisSummary> = {
  items: [analysisSummary],
  pageSize: 20,
  cursor: {
    nextCursor: null,
    hasNextPage: false,
  },
  queriedAt: TEST_TIMESTAMP,
};

export const emptyAnalysisPage: PaginationResult<AnalysisSummary> = {
  ...analysisPage,
  items: [],
};

export const analysisHistory: AnalysisHistory = {
  rootAnalysisRunId: "analysis_run_frontend",
  requestedAnalysisRunId: "analysis_run_frontend",
  channelId: "channel_fixture_complete",
  items: [
    {
      analysisRunId: "analysis_run_frontend",
      analysisId: "analysis_frontend",
      status: "completed",
      attempt: 1,
      retryOfAnalysisRunId: null,
      createdAt: TEST_TIMESTAMP,
      completedAt: TEST_TIMESTAMP,
    },
  ],
  queriedAt: TEST_TIMESTAMP,
};

export const statusSummary: AnalysisStatusSummary = {
  channelId: "channel_fixture_complete",
  total: 1,
  counts: {
    pending: 0,
    processing: 0,
    completed: 1,
    partial: 0,
    failed: 0,
  },
  queriedAt: TEST_TIMESTAMP,
};

export function successResponse<TData>(
  data: TData,
  status = 200,
): Response {
  return Response.json(
    {
      data,
      meta: {
        apiVersion: "v1",
        requestId: "request_frontend",
        timestamp: TEST_TIMESTAMP,
      },
    },
    { status },
  );
}

export function errorResponse(
  status: number,
  code = "INTERNAL_CODE_MUST_NOT_ESCAPE",
): Response {
  return Response.json(
    {
      error: {
        code,
        message: "Internal transport message must not reach UI.",
        details: [],
      },
      meta: {
        apiVersion: "v1",
        requestId: "request_frontend",
        timestamp: TEST_TIMESTAMP,
      },
    },
    { status },
  );
}

export type Deferred<TValue> = {
  promise: Promise<TValue>;
  resolve(value: TValue): void;
  reject(reason: unknown): void;
};

export function deferred<TValue>(): Deferred<TValue> {
  let resolvePromise: ((value: TValue) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<TValue>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve(value) {
      resolvePromise?.(value);
    },
    reject(reason) {
      rejectPromise?.(reason);
    },
  };
}

export function abortableFetch(
  response: Deferred<Response>,
): typeof globalThis.fetch {
  return async (_input, init) => {
    const signal = init?.signal;
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          response.reject(
            new DOMException("Request aborted.", "AbortError"),
          );
        },
        { once: true },
      );
    }
    return response.promise;
  };
}
