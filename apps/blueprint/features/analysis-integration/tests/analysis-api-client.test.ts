import assert from "node:assert/strict";
import test from "node:test";

import {
  AnalysisApiClient,
  AnalysisApiClientError,
} from "../client";
import {
  analysisDetails,
  analysisHistory,
  analysisPage,
  errorResponse,
  statusSummary,
  successResponse,
} from "./frontend-test-fixtures";

test("AnalysisApiClient calls every certified endpoint with typed serialization", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    successResponse(
      {
        analysisRunId: "analysis_run_frontend",
        analysis: analysisDetails,
      },
      201,
    ),
    successResponse(analysisPage),
    successResponse(analysisDetails),
    successResponse(analysisHistory),
    successResponse(
      {
        analysisRunId: "analysis_run_replay",
        replayedFromAnalysisRunId: "analysis_run_frontend",
        analysis: analysisDetails,
      },
      201,
    ),
    successResponse({
      analysisRunId: "analysis_run_frontend",
      deleted: true,
      revision: 3,
    }),
    successResponse(statusSummary),
  ];
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    assert.ok(response);
    return response;
  };
  const client = new AnalysisApiClient({
    baseUrl: "http://localhost:3002/",
    fetch: fetchMock,
  });

  await client.runAnalysis({
    fixtureId: "complete",
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
  });
  await client.listAnalysisRuns({
    channelId: "channel_fixture_complete",
    creatorId: "creator_fixture_complete",
    status: "completed",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-08-01T00:00:00.000Z",
    attempt: 1,
    analysisId: "analysis_frontend",
    cursor: "YWJj",
    limit: 25,
  });
  await client.getAnalysis("analysis_run_frontend");
  await client.getAnalysisHistory("analysis_run_frontend");
  await client.replayAnalysis("analysis_run_frontend", {
    fixtureId: "complete",
    newAnalysisRunId: "analysis_run_replay",
  });
  await client.deleteAnalysis("analysis_run_frontend", {
    expectedRevision: 3,
  });
  await client.getStatusSummary({
    channelId: "channel_fixture_complete",
    status: "completed",
  });

  assert.equal(requests.length, 7);
  assert.deepEqual(
    requests.map((request) => request.init?.method),
    ["POST", "GET", "GET", "GET", "POST", "DELETE", "GET"],
  );
  assert.equal(
    requests[0]?.url,
    "http://localhost:3002/api/internal/v1/analysis-runs",
  );
  assert.match(requests[1]?.url ?? "", /status=completed/);
  assert.match(requests[1]?.url ?? "", /cursor=YWJj/);
  assert.match(requests[1]?.url ?? "", /limit=25/);
  assert.match(requests[3]?.url ?? "", /\/history$/);
  assert.match(requests[4]?.url ?? "", /\/replay$/);
  assert.match(requests[5]?.url ?? "", /expectedRevision=3/);
  assert.match(requests[6]?.url ?? "", /status-summary/);
  assert.equal(requests[0]?.init?.cache, "no-store");
});

test("client validates success and error envelopes", async () => {
  const invalidSuccess = new AnalysisApiClient({
    fetch: async () => Response.json({ data: analysisDetails }),
  });
  const invalidError = new AnalysisApiClient({
    fetch: async () => Response.json({ message: "unsafe" }, { status: 500 }),
  });

  await assert.rejects(
    invalidSuccess.getAnalysis("analysis_run_frontend"),
    (error: unknown) =>
      error instanceof AnalysisApiClientError &&
      error.kind === "invalid-response",
  );
  await assert.rejects(
    invalidError.getAnalysis("analysis_run_frontend"),
    (error: unknown) =>
      error instanceof AnalysisApiClientError &&
      error.kind === "invalid-response",
  );
});

test("client maps 400, 404, 409, 422, and 500 without exposing internal codes", async () => {
  const cases = [
    { status: 400, kind: "invalid-request", retryable: false },
    { status: 404, kind: "not-found", retryable: false },
    { status: 409, kind: "conflict", retryable: false },
    { status: 422, kind: "unprocessable", retryable: false },
    { status: 500, kind: "server", retryable: true },
  ] as const;

  for (const item of cases) {
    const client = new AnalysisApiClient({
      fetch: async () => errorResponse(item.status),
    });
    await assert.rejects(
      client.getAnalysis("analysis_run_frontend"),
      (error: unknown) => {
        assert.ok(error instanceof AnalysisApiClientError);
        assert.equal(error.kind, item.kind);
        assert.equal(error.status, item.status);
        assert.equal(error.retryable, item.retryable);
        assert.doesNotMatch(error.message, /INTERNAL_CODE/);
        assert.equal("code" in error, false);
        return true;
      },
    );
  }
});

test("client maps network and AbortSignal failures safely", async () => {
  const network = new AnalysisApiClient({
    fetch: async () => {
      throw new Error("network contains a secret endpoint");
    },
  });
  const aborted = new AnalysisApiClient({
    fetch: async () => {
      throw new DOMException("aborted", "AbortError");
    },
  });

  await assert.rejects(
    network.getAnalysis("analysis_run_frontend"),
    (error: unknown) =>
      error instanceof AnalysisApiClientError &&
      error.kind === "network" &&
      error.retryable,
  );
  await assert.rejects(
    aborted.getAnalysis("analysis_run_frontend"),
    (error: unknown) =>
      error instanceof AnalysisApiClientError &&
      error.kind === "cancelled",
  );
});
