import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mapAnalysisRunToPersistenceRecord,
  mapPersistenceRecordToAnalysisRun,
  type AnalysisRun,
} from "../persistence";
import {
  ConnectedYouTubeStrategicPipeline,
  STRATEGIC_ANALYSIS_PROJECTION_VERSION,
  resolveStrategicProjection,
  validateStrategicAnalysisProjection,
} from "../intelligence";
import type { RawChannelData } from "../engines";

const ANALYZED_AT = "2026-07-20T12:00:00.000Z";
const raw: RawChannelData = {
  collectedAt: "2026-07-20T11:59:00.000Z",
  creator: { id: "creator_real", displayName: "Real Creator", locale: "es" },
  channel: {
    id: "channel_real",
    creatorId: "creator_real",
    name: "Real Channel",
    createdAt: "2020-01-01T00:00:00.000Z",
    subscribers: 1000,
    totalViews: 10000,
    totalVideos: 6,
    language: "es",
  },
  videos: [
    { id: "v1", title: "Creator workflow", publishedAt: "2026-01-01T12:00:00.000Z", durationSeconds: 300, views: 100, likes: 5, comments: 1 },
    { id: "v2", title: "Creator workflow advanced", publishedAt: "2026-01-08T12:00:00.000Z", durationSeconds: 330, views: 150, likes: 7, comments: 2 },
    { id: "v3", title: "Creator analytics", publishedAt: "2026-01-15T12:00:00.000Z", durationSeconds: 360, views: 220, likes: 12, comments: 3 },
    { id: "v4", title: "Creator system", publishedAt: "2026-01-22T12:00:00.000Z", durationSeconds: 420, views: 300, likes: 17, comments: 4 },
    { id: "v5", title: "Creator research system", publishedAt: "2026-02-19T12:00:00.000Z", durationSeconds: 510, views: 800, likes: 55, comments: 8 },
    { id: "v6", title: "Creator operating system", publishedAt: "2026-02-26T12:00:00.000Z", durationSeconds: 600, views: 2400, likes: 180, comments: 20 },
  ],
};

async function execute() {
  return new ConnectedYouTubeStrategicPipeline().run(raw, {
    analysisId: "analysis_real",
    analyzedAt: ANALYZED_AT,
    correlationId: "correlation_real",
    sourceReference: "channel-sync:real",
  });
}

test("connected YouTube pipeline composes all certified intelligence stages deterministically", async () => {
  const first = await execute();
  const second = await execute();
  assert.deepEqual(first, second);
  const projection = first.analysis.strategicProjection;
  assert.ok(projection);
  assert.equal(projection.schemaVersion, STRATEGIC_ANALYSIS_PROJECTION_VERSION);
  assert.equal(projection.sourceIntelligence.output.summary.channel.id, "channel_real");
  assert.equal(projection.creatorIntelligence.status, "success");
  assert.equal(projection.decisions.status, "completed");
  assert.deepEqual(validateStrategicAnalysisProjection(projection), []);
});

test("public-only connected data cannot produce Analytics-dependent decisions", async () => {
  const projection = (await execute()).analysis.strategicProjection;
  assert.ok(projection);
  assert.equal(projection.decisions.status, "completed");
  if (projection.decisions.status === "completed") {
    const ruleIds = projection.decisions.decisions.map((decision) => decision.ruleId);
    assert.equal(ruleIds.includes("decision-rule.low-click-through"), false);
    assert.equal(ruleIds.includes("decision-rule.strong-reach-weak-retention"), false);
  }
  const metrics = projection.sourceIntelligence.output.videos.flatMap((video) => video.availableMetrics);
  assert.equal(metrics.includes("ctr"), false);
  assert.equal(metrics.includes("averagePercentageViewed"), false);
});

test("version resolver marks historic runs without a strategic projection for reanalysis", () => {
  assert.deepEqual(resolveStrategicProjection(undefined), {
    status: "requires-reanalysis",
    reason: "missing",
  });
});

test("strategic projection persists and reloads with AnalysisRun V2", async () => {
  const analysis = (await execute()).analysis;
  const run: AnalysisRun = {
    schemaVersion: 2,
    revision: 3,
    analysisRunId: "run_real",
    creatorId: "creator_real",
    channelId: "channel_real",
    status: "completed",
    source: { sourceType: "connected-youtube", sourceSchemaVersion: "1.0", sourceReference: "channel-sync:real" },
    adapterMetadata: {
      adapterId: "persisted-youtube-channel-data",
      adapterVersion: "1.0.0",
      sourceType: "connected-youtube",
      supportedSchemaVersion: "1.0",
      processedAt: ANALYZED_AT,
    },
    adapterWarnings: [],
    pipelineVersion: "2.0.0",
    analysisResult: analysis,
    createdAt: ANALYZED_AT,
    updatedAt: ANALYZED_AT,
    completedAt: ANALYZED_AT,
    correlationId: "correlation_real",
    attempt: 1,
  };
  const record = mapAnalysisRunToPersistenceRecord(run);
  assert.equal(record.status, "success");
  if (record.status !== "success") return;
  const restored = mapPersistenceRecordToAnalysisRun(record.value);
  assert.equal(restored.status, "success");
  if (restored.status === "success") {
    assert.deepEqual(
      restored.value.analysisResult?.strategicProjection,
      JSON.parse(JSON.stringify(analysis.strategicProjection)) as unknown,
    );
    assert.equal(restored.value.analysisRunId, run.analysisRunId);
  }
});

test("strategic projection validation rejects sensitive or raw provider payload fields", async () => {
  const projection = structuredClone((await execute()).analysis.strategicProjection);
  assert.ok(projection);
  const unsafe = { ...projection, accessToken: "redacted-test-value" };
  assert.equal(
    validateStrategicAnalysisProjection(unsafe).some((item) => item.code === "forbidden-sensitive-field"),
    true,
  );
});