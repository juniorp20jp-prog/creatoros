import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_INTERNAL_ANALYSIS_BODY_BYTES,
  parseAnalysisRunId,
  parseDeleteAnalysisQuery,
  parseListAnalysisQuery,
  parseReplayAnalysisRequest,
  parseRunAnalysisRequest,
  parseStatusSummaryQuery,
} from "../validation";
import { jsonRequest } from "./api-test-fixtures";

test("run request accepts only the documented fixture contract", async () => {
  const result = await parseRunAnalysisRequest(
    jsonRequest("/analysis-runs", "POST", {
      fixtureId: "complete",
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      correlationId: "correlation_1",
      analysisRunId: "analysis_run_1",
    }),
  );

  assert.deepEqual(result, {
    status: "valid",
    value: {
      fixtureId: "complete",
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      correlationId: "correlation_1",
      analysisRunId: "analysis_run_1",
    },
  });
});

test("run request rejects empty, malformed, non-object, and oversized bodies", async () => {
  const empty = await parseRunAnalysisRequest(
    jsonRequest("/analysis-runs", "POST"),
  );
  const malformed = await parseRunAnalysisRequest(
    new Request("http://localhost/analysis-runs", {
      method: "POST",
      body: "{not-json",
    }),
  );
  const array = await parseRunAnalysisRequest(
    jsonRequest("/analysis-runs", "POST", []),
  );
  const oversized = await parseRunAnalysisRequest(
    new Request("http://localhost/analysis-runs", {
      method: "POST",
      body: "x".repeat(MAX_INTERNAL_ANALYSIS_BODY_BYTES + 1),
    }),
  );

  assert.equal(empty.status, "invalid");
  assert.equal(empty.status === "invalid" && empty.code, "INVALID_JSON");
  assert.equal(malformed.status, "invalid");
  assert.equal(array.status, "invalid");
  assert.equal(oversized.status, "invalid");
  assert.equal(
    oversized.status === "invalid" && oversized.code,
    "PAYLOAD_TOO_LARGE",
  );
});

test("run and replay requests reject unknown properties and invalid IDs", async () => {
  const run = await parseRunAnalysisRequest(
    jsonRequest("/analysis-runs", "POST", {
      fixtureId: "complete",
      creatorId: "",
      channelId: "channel with spaces",
      rawChannelData: { secret: true },
    }),
  );
  const replay = await parseReplayAnalysisRequest(
    jsonRequest("/analysis-runs/run/replay", "POST", {
      fixtureId: "complete",
      newAnalysisRunId: "",
      credentials: "forbidden",
    }),
  );

  assert.equal(run.status, "invalid");
  assert.equal(replay.status, "invalid");
  if (run.status === "invalid") {
    assert.ok(run.details.some((detail) => detail.code === "UNKNOWN_PROPERTY"));
    assert.ok(run.details.some((detail) => detail.path === "$.creatorId"));
  }
  if (replay.status === "invalid") {
    assert.ok(
      replay.details.some((detail) => detail.path === "$.credentials"),
    );
  }
});

test("analysisRunId validation rejects empty and unsafe path identifiers", () => {
  assert.equal(parseAnalysisRunId("analysis_run-1").status, "valid");
  assert.equal(parseAnalysisRunId("").status, "invalid");
  assert.equal(parseAnalysisRunId("../analysis").status, "invalid");
  assert.equal(parseAnalysisRunId("analysis run").status, "invalid");
});

test("list query validates and maps every supported filter", () => {
  const result = parseListAnalysisQuery(
    new Request(
      "http://localhost/analysis-runs?channelId=channel_1&creatorId=creator_1&status=partial&from=2026-01-01T00%3A00%3A00.000Z&to=2026-08-01T00%3A00%3A00.000Z&attempt=2&analysisId=analysis_1&cursor=YWJj&limit=25",
    ),
  );

  assert.equal(result.status, "valid");
  if (result.status === "valid") {
    assert.deepEqual(result.value, {
      filters: {
        channelId: "channel_1",
        creatorId: "creator_1",
        status: "partial",
        createdFrom: "2026-01-01T00:00:00.000Z",
        createdTo: "2026-08-01T00:00:00.000Z",
        attempt: 2,
        analysisId: "analysis_1",
      },
      cursor: "YWJj",
      pageSize: 25,
    });
  }
});

test("list query rejects missing channel, invalid filters, offset, and duplicates", () => {
  const invalid = [
    "?status=unknown",
    "?channelId=channel_1&from=yesterday",
    "?channelId=channel_1&from=2026-08-01T00%3A00%3A00.000Z&to=2026-01-01T00%3A00%3A00.000Z",
    "?channelId=channel_1&attempt=0",
    "?channelId=channel_1&limit=101",
    "?channelId=channel_1&cursor=not%20opaque",
    "?channelId=channel_1&offset=10",
    "?channelId=channel_1&channelId=channel_2",
  ];

  for (const query of invalid) {
    assert.equal(
      parseListAnalysisQuery(
        new Request(`http://localhost/analysis-runs${query}`),
      ).status,
      "invalid",
    );
  }
});

test("status summary reuses filters but rejects pagination parameters", () => {
  assert.equal(
    parseStatusSummaryQuery(
      new Request(
        "http://localhost/status-summary?channelId=channel_1&status=failed",
      ),
    ).status,
    "valid",
  );
  assert.equal(
    parseStatusSummaryQuery(
      new Request(
        "http://localhost/status-summary?channelId=channel_1&limit=5",
      ),
    ).status,
    "invalid",
  );
});

test("delete query accepts an optional positive revision only", () => {
  assert.deepEqual(
    parseDeleteAnalysisQuery(
      new Request("http://localhost/analysis-runs/run"),
    ),
    { status: "valid", value: {} },
  );
  assert.deepEqual(
    parseDeleteAnalysisQuery(
      new Request(
        "http://localhost/analysis-runs/run?expectedRevision=3",
      ),
    ),
    { status: "valid", value: { expectedRevision: 3 } },
  );
  assert.equal(
    parseDeleteAnalysisQuery(
      new Request(
        "http://localhost/analysis-runs/run?expectedRevision=0",
      ),
    ).status,
    "invalid",
  );
  assert.equal(
    parseDeleteAnalysisQuery(
      new Request("http://localhost/analysis-runs/run?cascade=true"),
    ).status,
    "invalid",
  );
});
