import assert from "node:assert/strict";
import test from "node:test";

import * as analysisRunsRoute from "../../../app/api/internal/v1/analysis-runs/route";
import * as analysisRunRoute from "../../../app/api/internal/v1/analysis-runs/[analysisRunId]/route";
import * as historyRoute from "../../../app/api/internal/v1/analysis-runs/[analysisRunId]/history/route";
import * as replayRoute from "../../../app/api/internal/v1/analysis-runs/[analysisRunId]/replay/route";
import * as summaryRoute from "../../../app/api/internal/v1/analysis-runs/status-summary/route";
import {
  INTERNAL_ANALYSIS_API_PREFIX,
  INTERNAL_ANALYSIS_API_VERSION,
} from "../contracts";
import { InternalAnalysisFixtureCatalog } from "../fixture-catalog";

test("the internal v1 route surface exposes only documented methods", () => {
  assert.equal(INTERNAL_ANALYSIS_API_PREFIX, "/api/internal/v1");
  assert.equal(INTERNAL_ANALYSIS_API_VERSION, "v1");
  assert.equal(typeof analysisRunsRoute.GET, "function");
  assert.equal(typeof analysisRunsRoute.POST, "function");
  assert.equal(typeof analysisRunRoute.GET, "function");
  assert.equal(typeof analysisRunRoute.DELETE, "function");
  assert.equal(typeof historyRoute.GET, "function");
  assert.equal(typeof replayRoute.POST, "function");
  assert.equal(typeof summaryRoute.GET, "function");
  assert.equal("DELETE" in analysisRunsRoute, false);
  assert.equal("PUT" in analysisRunRoute, false);
});

test("all Route Handlers are dynamic Node.js handlers", () => {
  for (const route of [
    analysisRunsRoute,
    analysisRunRoute,
    historyRoute,
    replayRoute,
    summaryRoute,
  ]) {
    assert.equal(route.dynamic, "force-dynamic");
    assert.equal(route.runtime, "nodejs");
  }
});

test("the fixture catalog is a closed, deterministic allowlist", () => {
  const catalog = new InternalAnalysisFixtureCatalog();
  assert.deepEqual(catalog.listIds(), [
    "complete",
    "invalidMetrics",
    "noVideos",
    "partial",
    "unknownFields",
  ]);
  assert.equal(catalog.get("complete")?.channelId, "channel_fixture_complete");
  assert.equal(catalog.get("provider-payload"), undefined);
});
