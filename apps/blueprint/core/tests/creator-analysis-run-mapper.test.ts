import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATOR_ANALYSIS_RUN_SCHEMA_VERSION,
  CreatorAnalysisRunPersistenceError,
  deserializeCreatorAnalysisRun,
  serializeCreatorAnalysisRun,
  type CreatorAnalysisRun,
} from "../persistence";
import {
  createCompletedAnalysisRunFixture,
  createFailedAnalysisRunFixture,
} from "./fixtures/creator-analysis-run-fixtures";

test("a valid analysis run is converted into a versioned record", async () => {
  const record = serializeCreatorAnalysisRun(
    await createCompletedAnalysisRunFixture(),
  );
  assert.equal(record.schemaVersion, CREATOR_ANALYSIS_RUN_SCHEMA_VERSION);
  assert.equal(record.snapshots.analysis.status, "completed");
  assert.equal(record.source.platform, "youtube");
});

test("run timestamps are normalized to canonical ISO 8601 UTC", async () => {
  const record = serializeCreatorAnalysisRun(
    await createCompletedAnalysisRunFixture(),
  );
  assert.equal(record.createdAt, "2026-07-20T12:00:00.000Z");
  assert.equal(record.updatedAt, "2026-07-20T12:05:00.000Z");
});

test("serialization and deserialization preserve supported run data", async () => {
  const run = await createCompletedAnalysisRunFixture({
    referenceChannel: { id: "reference_channel", name: "Reference Channel" },
  });
  const record = serializeCreatorAnalysisRun(run);
  const result = deserializeCreatorAnalysisRun(record);
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.deepEqual(result.run, {
      ...run,
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-20T12:05:00.000Z",
    });
  }
});

test("optional fields round-trip without fabricated values", () => {
  const run = createFailedAnalysisRunFixture();
  const result = deserializeCreatorAnalysisRun(
    serializeCreatorAnalysisRun(run),
  );
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.run.source.referenceChannel, null);
    assert.equal(result.run.metadata.correlationId, null);
    assert.equal("totalViews" in result.run.snapshots.input.channel, false);
  }
});

test("empty arrays, zero values, and false values are preserved", () => {
  const result = deserializeCreatorAnalysisRun(
    serializeCreatorAnalysisRun(createFailedAnalysisRunFixture()),
  );
  assert.equal(result.status, "success");
  if (result.status === "success") {
    const analysis = result.run.snapshots.analysis;
    assert.equal(result.run.snapshots.input.channel.subscribers, 0);
    assert.equal(result.run.snapshots.input.videos[0]?.views, 0);
    assert.equal(analysis.status, "failed");
    if (analysis.status === "failed") {
      assert.equal(analysis.error.retryable, false);
      assert.deepEqual(analysis.metadata.providerIds, []);
    }
  }
});

test("serialization is deterministic and does not mutate its input", async () => {
  const run = await createCompletedAnalysisRunFixture();
  const before = structuredClone(run);
  const first = serializeCreatorAnalysisRun(run);
  const second = serializeCreatorAnalysisRun(run);
  assert.deepEqual(first, second);
  assert.deepEqual(run, before);
});

test("deserialization does not mutate the persisted record", async () => {
  const record = serializeCreatorAnalysisRun(
    await createCompletedAnalysisRunFixture(),
  );
  const before = structuredClone(record);
  deserializeCreatorAnalysisRun(record);
  assert.deepEqual(record, before);
});

test("decision IDs and ordering are preserved", async () => {
  const run = await createCompletedAnalysisRunFixture();
  const expected =
    run.snapshots.decisions?.decisions.map((decision) => decision.id) ?? [];
  const result = deserializeCreatorAnalysisRun(
    serializeCreatorAnalysisRun(run),
  );
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.deepEqual(
      result.run.snapshots.decisions?.decisions.map((decision) => decision.id),
      expected,
    );
  }
});

test("invalid run timestamps produce a typed serialization error", async () => {
  const run = await createCompletedAnalysisRunFixture({ createdAt: "invalid" });
  assert.throws(
    () => serializeCreatorAnalysisRun(run),
    (error: unknown) =>
      error instanceof CreatorAnalysisRunPersistenceError &&
      error.code === "serialization-failed",
  );
});

test("undefined values are rejected instead of being removed", async () => {
  const run = await createCompletedAnalysisRunFixture();
  const unsafe = structuredClone(run) as CreatorAnalysisRun & {
    unsupported?: undefined;
  };
  unsafe.unsupported = undefined;
  assert.throws(
    () => serializeCreatorAnalysisRun(unsafe),
    (error: unknown) =>
      error instanceof CreatorAnalysisRunPersistenceError &&
      error.issues.some((entry) => entry.code === "undefined-value"),
  );
});
