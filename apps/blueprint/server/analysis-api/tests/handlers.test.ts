import assert from "node:assert/strict";
import test from "node:test";

import type {
  AnalysisQueryErrorCode,
  AnalysisServiceErrorCode,
  RunAnalysisInput,
} from "../../../core";
import { InternalAnalysisApi } from "../internal-analysis-api";
import {
  createHistory,
  createPage,
  createStatusSummary,
  createTestDependencies,
  jsonRequest,
  queryError,
  responseJson,
  serviceError,
  TEST_TIMESTAMP,
} from "./api-test-fixtures";

test("POST runAnalysis returns 201, uses an allowlisted fixture, and exposes only a read model", async () => {
  const dependencies = createTestDependencies();
  let received: RunAnalysisInput<unknown> | undefined;
  const original = dependencies.analysisService.runAnalysis;
  dependencies.analysisService.runAnalysis = async (input) => {
    received = input;
    return original(input);
  };
  const api = new InternalAnalysisApi(dependencies);

  const response = await api.runAnalysis(
    jsonRequest("/api/internal/v1/analysis-runs", "POST", {
      fixtureId: "complete",
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      correlationId: "correlation_api",
      analysisRunId: "analysis_run_api",
    }),
  );
  const body = await responseJson(response);
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 201);
  assert.equal(received?.sourceReference, "fixture:complete");
  assert.equal(received?.creatorId, "creator_fixture_complete");
  assert.match(serialized, /analysis_run_api/);
  assert.doesNotMatch(serialized, /rawChannelData/i);
  assert.doesNotMatch(serialized, /prisma/i);
  assert.doesNotMatch(serialized, /postgresql:\/\//i);
});

test("POST runAnalysis rejects unknown fixtures and identity mismatches", async () => {
  const api = new InternalAnalysisApi(createTestDependencies());
  const unknown = await api.runAnalysis(
    jsonRequest("/api/internal/v1/analysis-runs", "POST", {
      fixtureId: "missing",
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
    }),
  );
  const mismatch = await api.runAnalysis(
    jsonRequest("/api/internal/v1/analysis-runs", "POST", {
      fixtureId: "complete",
      creatorId: "creator_other",
      channelId: "channel_fixture_complete",
    }),
  );

  assert.equal(unknown.status, 404);
  assert.equal(
    (await responseJson(unknown)).error instanceof Object,
    true,
  );
  assert.equal(mismatch.status, 422);
  assert.match(JSON.stringify(await responseJson(mismatch)), /FIXTURE_IDENTITY_MISMATCH/);
});

test("POST runAnalysis maps adapter, pipeline, duplicate, and persistence failures", async () => {
  const cases: ReadonlyArray<{
    serviceCode: AnalysisServiceErrorCode;
    causeCode?: string;
    status: number;
    apiCode: string;
  }> = [
    {
      serviceCode: "adapter-failure",
      status: 422,
      apiCode: "ANALYSIS_ADAPTER_FAILED",
    },
    {
      serviceCode: "pipeline-failure",
      status: 422,
      apiCode: "ANALYSIS_PIPELINE_FAILED",
    },
    {
      serviceCode: "persistence-failure",
      causeCode: "duplicate-id",
      status: 409,
      apiCode: "DUPLICATE_ANALYSIS_RUN_ID",
    },
    {
      serviceCode: "persistence-failure",
      status: 500,
      apiCode: "ANALYSIS_PERSISTENCE_FAILED",
    },
  ];

  for (const item of cases) {
    const dependencies = createTestDependencies({
      analysisService: {
        async runAnalysis() {
          return {
            status: "failure",
            error: serviceError(item.serviceCode, item.causeCode),
          };
        },
      },
    });
    const response = await new InternalAnalysisApi(dependencies).runAnalysis(
      jsonRequest("/api/internal/v1/analysis-runs", "POST", {
        fixtureId: "complete",
        creatorId: "creator_fixture_complete",
        channelId: "channel_fixture_complete",
      }),
    );
    const serialized = JSON.stringify(await responseJson(response));
    assert.equal(response.status, item.status);
    assert.match(serialized, new RegExp(item.apiCode));
    assert.doesNotMatch(serialized, /secret|postgresql:\/\//i);
  }
});

test("GET by ID returns AnalysisDetails and maps not-found, invalid IDs, and persistence failures", async () => {
  const success = await new InternalAnalysisApi(
    createTestDependencies(),
  ).getAnalysis("analysis_run_api");
  assert.equal(success.status, 200);
  assert.match(JSON.stringify(await responseJson(success)), /pipelineVersion/);

  const cases: ReadonlyArray<{
    code: AnalysisQueryErrorCode;
    status: number;
  }> = [
    { code: "not-found", status: 404 },
    { code: "repository-failure", status: 500 },
  ];
  for (const item of cases) {
    const response = await new InternalAnalysisApi(
      createTestDependencies({
        analysisQueryService: {
          async getAnalysisById() {
            return {
              status: "failure",
              error: queryError(item.code),
            };
          },
        },
      }),
    ).getAnalysis("analysis_run_api");
    assert.equal(response.status, item.status);
    assert.doesNotMatch(
      JSON.stringify(await responseJson(response)),
      /SELECT \* FROM secret/,
    );
  }
  assert.equal(
    (await new InternalAnalysisApi(createTestDependencies()).getAnalysis("../unsafe"))
      .status,
    400,
  );
});

test("GET list forwards validated filters and opaque cursor", async () => {
  const dependencies = createTestDependencies();
  let captured: unknown;
  dependencies.analysisQueryService.listAnalysisRuns = async (query) => {
    captured = query;
    return {
      status: "success",
      value: {
        ...createPage(),
        cursor: { nextCursor: "bmV4dA", hasNextPage: true },
      },
    };
  };
  const response = await new InternalAnalysisApi(
    dependencies,
  ).listAnalysisRuns(
    new Request(
      "http://localhost/api/internal/v1/analysis-runs?channelId=channel_fixture_complete&creatorId=creator_fixture_complete&status=partial&attempt=2&limit=10&cursor=YWJj",
    ),
  );
  const serialized = JSON.stringify(await responseJson(response));

  assert.equal(response.status, 200);
  assert.deepEqual(captured, {
    filters: {
      channelId: "channel_fixture_complete",
      creatorId: "creator_fixture_complete",
      status: "partial",
      attempt: 2,
    },
    pageSize: 10,
    cursor: "YWJj",
  });
  assert.match(serialized, /bmV4dA/);
  assert.doesNotMatch(serialized, /repositoryCursor|filterSignature/);
});

test("GET list returns empty pages and rejects invalid cursor, dates, status, and limits", async () => {
  const dependencies = createTestDependencies({
    analysisQueryService: {
      async listAnalysisRuns() {
        return { status: "success", value: createPage([]) };
      },
    },
  });
  const api = new InternalAnalysisApi(dependencies);
  const empty = await api.listAnalysisRuns(
    new Request(
      "http://localhost/api/internal/v1/analysis-runs?channelId=channel_fixture_complete",
    ),
  );
  assert.equal(empty.status, 200);
  assert.match(JSON.stringify(await responseJson(empty)), /"items":\[\]/);

  for (const suffix of [
    "&cursor=not%20opaque",
    "&from=invalid",
    "&status=unknown",
    "&limit=101",
  ]) {
    const response = await api.listAnalysisRuns(
      new Request(
        `http://localhost/api/internal/v1/analysis-runs?channelId=channel_fixture_complete${suffix}`,
      ),
    );
    assert.equal(response.status, 400);
  }
});

test("GET history returns official lineage and handles a single run and not-found", async () => {
  const api = new InternalAnalysisApi(createTestDependencies());
  const history = await api.getAnalysisHistory("analysis_run_replay");
  assert.equal(history.status, 200);
  assert.deepEqual(
    (await responseJson(history)).data,
    createHistory(),
  );

  const singleDependencies = createTestDependencies({
    analysisQueryService: {
      async getAnalysisHistory() {
        const value = createHistory();
        return {
          status: "success",
          value: { ...value, items: [value.items[0]!] },
        };
      },
    },
  });
  const single = await new InternalAnalysisApi(
    singleDependencies,
  ).getAnalysisHistory("analysis_run_api");
  assert.equal(single.status, 200);

  const missing = await new InternalAnalysisApi(
    createTestDependencies({
      analysisQueryService: {
        async getAnalysisHistory() {
          return {
            status: "failure",
            error: queryError("not-found"),
          };
        },
      },
    }),
  ).getAnalysisHistory("analysis_run_missing");
  assert.equal(missing.status, 404);
});

test("POST replay creates a new run and forwards only fixture source plus replay controls", async () => {
  const dependencies = createTestDependencies();
  let captured: unknown;
  const original = dependencies.analysisService.replayAnalysis;
  dependencies.analysisService.replayAnalysis = async (input) => {
    captured = input;
    return original(input);
  };
  const response = await new InternalAnalysisApi(dependencies).replayAnalysis(
    jsonRequest(
      "/api/internal/v1/analysis-runs/analysis_run_api/replay",
      "POST",
      {
        fixtureId: "complete",
        correlationId: "correlation_replay",
        newAnalysisRunId: "analysis_run_replay",
      },
    ),
    "analysis_run_api",
  );

  assert.equal(response.status, 201);
  assert.deepEqual(captured, {
    analysisRunId: "analysis_run_api",
    sourceData: dependencies.fixtureCatalog.get("complete")?.sourceData,
    sourceReference: "fixture:complete",
    correlationId: "correlation_replay",
    newAnalysisRunId: "analysis_run_replay",
  });
  assert.match(
    JSON.stringify(await responseJson(response)),
    /replayedFromAnalysisRunId/,
  );
});

test("POST replay rejects unknown fixtures and maps service failures", async () => {
  const api = new InternalAnalysisApi(createTestDependencies());
  const invalidFixture = await api.replayAnalysis(
    jsonRequest("/replay", "POST", { fixtureId: "missing" }),
    "analysis_run_api",
  );
  assert.equal(invalidFixture.status, 404);

  const failed = await new InternalAnalysisApi(
    createTestDependencies({
      analysisService: {
        async replayAnalysis() {
          return {
            status: "failure",
            error: {
              ...serviceError("concurrency-conflict"),
              operation: "replay-analysis",
            },
          };
        },
      },
    }),
  ).replayAnalysis(
    jsonRequest("/replay", "POST", { fixtureId: "complete" }),
    "analysis_run_api",
  );
  assert.equal(failed.status, 409);
});

test("DELETE forwards expectedRevision and returns only deletion confirmation", async () => {
  const dependencies = createTestDependencies();
  let captured: unknown;
  dependencies.analysisService.deleteAnalysis = async (
    analysisRunId,
    options,
  ) => {
    captured = { analysisRunId, options };
    return {
      status: "success",
      value: { analysisRunId, revision: 3 },
    };
  };
  const response = await new InternalAnalysisApi(dependencies).deleteAnalysis(
    new Request(
      "http://localhost/api/internal/v1/analysis-runs/analysis_run_api?expectedRevision=3",
      { method: "DELETE" },
    ),
    "analysis_run_api",
  );
  const serialized = JSON.stringify(await responseJson(response));

  assert.equal(response.status, 200);
  assert.deepEqual(captured, {
    analysisRunId: "analysis_run_api",
    options: { expectedRevision: 3 },
  });
  assert.match(serialized, /"deleted":true/);
  assert.doesNotMatch(serialized, /adapterMetadata|analysisResult/);
});

test("DELETE maps not-found and stale revision and rejects invalid IDs", async () => {
  for (const item of [
    { code: "not-found" as const, status: 404 },
    { code: "concurrency-conflict" as const, status: 409 },
  ]) {
    const response = await new InternalAnalysisApi(
      createTestDependencies({
        analysisService: {
          async deleteAnalysis() {
            return {
              status: "failure",
              error: {
                ...serviceError(item.code),
                operation: "delete-analysis",
              },
            };
          },
        },
      }),
    ).deleteAnalysis(
      new Request("http://localhost/delete", { method: "DELETE" }),
      "analysis_run_api",
    );
    assert.equal(response.status, item.status);
  }
  assert.equal(
    (
      await new InternalAnalysisApi(
        createTestDependencies(),
      ).deleteAnalysis(
        new Request("http://localhost/delete", { method: "DELETE" }),
        "",
      )
    ).status,
    400,
  );
});

test("status summary returns supported counts including derived partial and empty summaries", async () => {
  const api = new InternalAnalysisApi(createTestDependencies());
  const response = await api.summarizeAnalysisRuns(
    new Request(
      "http://localhost/status-summary?channelId=channel_fixture_complete",
    ),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    (await responseJson(response)).data,
    createStatusSummary(),
  );

  const dependencies = createTestDependencies({
    analysisQueryService: {
      async summarizeAnalysisRuns() {
        return {
          status: "success",
          value: {
            ...createStatusSummary(),
            total: 0,
            counts: {
              pending: 0,
              processing: 0,
              completed: 0,
              partial: 0,
              failed: 0,
            },
          },
        };
      },
    },
  });
  const empty = await new InternalAnalysisApi(
    dependencies,
  ).summarizeAnalysisRuns(
    new Request(
      "http://localhost/status-summary?channelId=channel_fixture_complete",
    ),
  );
  assert.match(JSON.stringify(await responseJson(empty)), /"total":0/);
});

test("every envelope has deterministic version, request ID, timestamp, and safe errors", async () => {
  const response = await new InternalAnalysisApi(
    createTestDependencies({
      analysisQueryService: {
        async getAnalysisById() {
          return {
            status: "failure",
            error: queryError("repository-failure"),
          };
        },
      },
    }),
  ).getAnalysis("analysis_run_api");
  const body = await responseJson(response);
  assert.deepEqual(body.meta, {
    apiVersion: "v1",
    requestId: "request_fixed",
    timestamp: TEST_TIMESTAMP,
  });
  const serialized = JSON.stringify(body);
  assert.match(serialized, /ANALYSIS_PERSISTENCE_FAILED/);
  assert.doesNotMatch(serialized, /SELECT|stack|Prisma|postgresql:\/\//i);
});

test("unexpected dependency exceptions become safe internal errors", async () => {
  const response = await new InternalAnalysisApi(
    createTestDependencies({
      analysisQueryService: {
        async getAnalysisById() {
          throw new Error("postgresql://user:secret@host/db SELECT secret");
        },
      },
    }),
  ).getAnalysis("analysis_run_api");
  const serialized = JSON.stringify(await responseJson(response));
  assert.equal(response.status, 500);
  assert.match(serialized, /INTERNAL_ERROR/);
  assert.doesNotMatch(serialized, /secret|SELECT|postgresql:\/\//i);
});
