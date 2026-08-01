import type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisQueryError,
  AnalysisResult,
  AnalysisRun,
  AnalysisServiceError,
  AnalysisStatusSummary,
  AnalysisSummary,
  Clock,
  IdGenerator,
  PaginationResult,
} from "../../../core";
import {
  createAnalysisResultFixture,
  fixtureAdapterMetadata,
} from "../../../core/tests/fixtures/analysis-run-v2-fixtures";
import type {
  AnalysisApplicationService,
  AnalysisReadService,
  InternalAnalysisApiDependencies,
} from "../contracts";
import { InternalAnalysisFixtureCatalog } from "../fixture-catalog";

export const TEST_TIMESTAMP = "2026-08-01T12:00:00.000Z";

export class FixedClock implements Clock {
  now(): string {
    return TEST_TIMESTAMP;
  }
}

export class FixedIdGenerator implements IdGenerator {
  create(prefix: string): string {
    return `${prefix}_fixed`;
  }
}

export function createRun(
  overrides: Partial<AnalysisRun> = {},
): AnalysisRun {
  const analysisResult = createAnalysisResultFixture();
  return {
    schemaVersion: 2,
    revision: 3,
    analysisRunId: "analysis_run_api",
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
    status: "completed",
    source: {
      sourceType: "local-fixture",
      sourceSchemaVersion: "1",
      sourceReference: "fixture:complete",
    },
    adapterMetadata: fixtureAdapterMetadata,
    adapterWarnings: [],
    pipelineVersion: "1.0.0",
    analysisResult,
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    completedAt: TEST_TIMESTAMP,
    correlationId: "correlation_api",
    attempt: 1,
    ...overrides,
  };
}

export function createSummary(
  overrides: Partial<AnalysisSummary> = {},
): AnalysisSummary {
  return {
    analysisRunId: "analysis_run_api",
    analysisId: "analysis_analysis_run_api",
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
    status: "completed",
    attempt: 1,
    retryOfAnalysisRunId: null,
    warningCount: 0,
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    completedAt: TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createDetails(
  overrides: Partial<AnalysisDetails> = {},
): AnalysisDetails {
  return {
    summary: createSummary(),
    source: {
      sourceType: "local-fixture",
      sourceSchemaVersion: "1",
      sourceReference: "fixture:complete",
    },
    pipelineVersion: "1.0.0",
    correlationId: "correlation_api",
    analysisResult: createAnalysisResultFixture(),
    failure: null,
    ...overrides,
  };
}

export function createPage(
  items: ReadonlyArray<AnalysisSummary> = [createSummary()],
): PaginationResult<AnalysisSummary> {
  return {
    items,
    pageSize: 20,
    cursor: { nextCursor: null, hasNextPage: false },
    queriedAt: TEST_TIMESTAMP,
  };
}

export function createHistory(): AnalysisHistory {
  return {
    rootAnalysisRunId: "analysis_run_api",
    requestedAnalysisRunId: "analysis_run_replay",
    channelId: "channel_fixture_complete",
    items: [
      {
        analysisRunId: "analysis_run_api",
        analysisId: "analysis_analysis_run_api",
        status: "completed",
        attempt: 1,
        retryOfAnalysisRunId: null,
        createdAt: TEST_TIMESTAMP,
        completedAt: TEST_TIMESTAMP,
      },
      {
        analysisRunId: "analysis_run_replay",
        analysisId: "analysis_analysis_run_replay",
        status: "partial",
        attempt: 2,
        retryOfAnalysisRunId: "analysis_run_api",
        createdAt: TEST_TIMESTAMP,
        completedAt: TEST_TIMESTAMP,
      },
    ],
    queriedAt: TEST_TIMESTAMP,
  };
}

export function createStatusSummary(): AnalysisStatusSummary {
  return {
    channelId: "channel_fixture_complete",
    total: 5,
    counts: {
      pending: 1,
      processing: 1,
      completed: 1,
      partial: 1,
      failed: 1,
    },
    queriedAt: TEST_TIMESTAMP,
  };
}

export function serviceError(
  code: AnalysisServiceError["code"],
  causeCode = "TEST_CAUSE",
): AnalysisServiceError {
  return {
    code,
    operation: "run-analysis",
    message: "sensitive service error with postgresql://secret",
    causeCode,
  };
}

export function queryError(
  code: AnalysisQueryError["code"],
): AnalysisQueryError {
  return {
    code,
    operation: "get-analysis-by-id",
    message: "sensitive query error with SELECT * FROM secret",
    causeCode: "TEST_QUERY_CAUSE",
  };
}

type TestOverrides = {
  analysisService?: Partial<AnalysisApplicationService>;
  analysisQueryService?: Partial<AnalysisReadService>;
};

export function createTestDependencies(
  overrides: TestOverrides = {},
): InternalAnalysisApiDependencies {
  const run = createRun();
  const analysisResult = run.analysisResult as AnalysisResult;
  const analysisService: AnalysisApplicationService = {
    async runAnalysis() {
      return {
        status: "success",
        value: {
          analysisRunId: run.analysisRunId,
          adapterStatus: "success",
          analysisResult,
          run,
        },
      };
    },
    async replayAnalysis() {
      const replay = createRun({
        analysisRunId: "analysis_run_replay",
        attempt: 2,
        retryOfAnalysisRunId: run.analysisRunId,
      });
      return {
        status: "success",
        value: {
          analysisRunId: replay.analysisRunId,
          adapterStatus: "success",
          analysisResult,
          run: replay,
          replayedFromAnalysisRunId: run.analysisRunId,
        },
      };
    },
    async deleteAnalysis(analysisRunId) {
      return {
        status: "success",
        value: { analysisRunId, revision: run.revision },
      };
    },
    ...overrides.analysisService,
  };
  const analysisQueryService: AnalysisReadService = {
    async getAnalysisById(analysisRunId) {
      return {
        status: "success",
        value: createDetails({
          summary: createSummary({ analysisRunId }),
        }),
      };
    },
    async listAnalysisRuns() {
      return { status: "success", value: createPage() };
    },
    async getAnalysisHistory() {
      return { status: "success", value: createHistory() };
    },
    async summarizeAnalysisRuns() {
      return { status: "success", value: createStatusSummary() };
    },
    ...overrides.analysisQueryService,
  };
  return {
    analysisService,
    analysisQueryService,
    fixtureCatalog: new InternalAnalysisFixtureCatalog(),
    clock: new FixedClock(),
    requestIdGenerator: new FixedIdGenerator(),
  };
}

export function jsonRequest(
  path: string,
  method: "POST" | "DELETE",
  body?: unknown,
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
}

export async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const value = (await response.json()) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object response.");
  }
  return value as Record<string, unknown>;
}
