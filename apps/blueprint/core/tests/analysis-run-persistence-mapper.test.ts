import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InMemoryAnalysisRunRepository,
  mapAnalysisRunToPersistenceRecord,
  mapPersistenceRecordToAnalysisRun,
  type AnalysisRun,
  type AnalysisRunPersistenceRecord,
} from "../persistence";
import {
  TestClock,
  baseAnalysisRunInput,
  createAnalysisResultFixture,
  fixtureAdapterMetadata,
} from "./fixtures/analysis-run-v2-fixtures";

async function createRun(
  status: "pending" | "processing" | "completed" | "failed",
): Promise<AnalysisRun> {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock([
      "2026-07-20T13:00:00.000Z",
      "2026-07-20T13:00:01.000Z",
      "2026-07-20T13:00:02.000Z",
    ]),
  );
  const created = await repository.create(baseAnalysisRunInput);
  assert.equal(created.status, "success");
  if (created.status !== "success" || status === "pending") {
    return created.status === "success"
      ? created.value
      : assert.fail("Run creation failed.");
  }

  const processing = await repository.updateStatus(
    baseAnalysisRunInput.analysisRunId,
    "processing",
    { expectedRevision: created.value.revision },
  );
  assert.equal(processing.status, "success");
  if (processing.status !== "success" || status === "processing") {
    return processing.status === "success"
      ? processing.value
      : assert.fail("Run transition failed.");
  }

  if (status === "completed") {
    const completed = await repository.complete(
      baseAnalysisRunInput.analysisRunId,
      {
        analysisResult: createAnalysisResultFixture(),
        adapterMetadata: fixtureAdapterMetadata,
        adapterWarnings: [],
      },
      { expectedRevision: processing.value.revision },
    );
    assert.equal(completed.status, "success");
    return completed.status === "success"
      ? completed.value
      : assert.fail("Run completion failed.");
  }

  const failed = await repository.fail(
    baseAnalysisRunInput.analysisRunId,
    {
      failure: {
        stage: "pipeline",
        code: "PIPELINE_FAILED",
        message: "Controlled failure.",
      },
      adapterMetadata: fixtureAdapterMetadata,
      adapterWarnings: [],
    },
    { expectedRevision: processing.value.revision },
  );
  assert.equal(failed.status, "success");
  return failed.status === "success"
    ? failed.value
    : assert.fail("Run failure transition failed.");
}

test("persistence mapper round-trips a valid pending run", async () => {
  const run = await createRun("pending");
  const record = mapAnalysisRunToPersistenceRecord(run);

  assert.equal(record.status, "success");
  if (record.status !== "success") {
    return;
  }
  const restored = mapPersistenceRecordToAnalysisRun(record.value);

  assert.equal(restored.status, "success");
  if (restored.status === "success") {
    assert.deepEqual(restored.value, run);
    assert.notEqual(restored.value, run);
  }
});

test("persistence mapper preserves completed terminal data", async () => {
  const run = await createRun("completed");
  const mapped = mapAnalysisRunToPersistenceRecord(run);

  assert.equal(mapped.status, "success");
  if (mapped.status !== "success") {
    return;
  }
  assert.equal(mapped.value.status, "completed");
  assert.equal(mapped.value.revision, 3);
  assert.equal(mapped.value.failure, undefined);
  assert.equal(
    mapped.value.analysisResult?.analysisId,
    "analysis_analysis_run_test",
  );

  const restored = mapPersistenceRecordToAnalysisRun(mapped.value);
  assert.equal(restored.status, "success");
  if (restored.status === "success") {
    assert.deepEqual(restored.value, run);
  }
});

test("persistence mapper preserves failed terminal data", async () => {
  const run = await createRun("failed");
  const mapped = mapAnalysisRunToPersistenceRecord(run);

  assert.equal(mapped.status, "success");
  if (mapped.status !== "success") {
    return;
  }
  assert.equal(mapped.value.status, "failed");
  assert.equal(mapped.value.analysisResult, undefined);
  assert.equal(mapped.value.failure?.code, "PIPELINE_FAILED");

  const restored = mapPersistenceRecordToAnalysisRun(mapped.value);
  assert.equal(restored.status, "success");
  if (restored.status === "success") {
    assert.deepEqual(restored.value, run);
  }
});

test("persistence mapper rejects invalid timestamps", async () => {
  const run = await createRun("pending");
  const mapped = mapAnalysisRunToPersistenceRecord(run);
  assert.equal(mapped.status, "success");
  if (mapped.status !== "success") {
    return;
  }

  const corrupted = {
    ...mapped.value,
    createdAt: "not-a-timestamp",
  };
  const restored = mapPersistenceRecordToAnalysisRun(corrupted);

  assert.equal(restored.status, "failure");
  if (restored.status === "failure") {
    assert.equal(restored.error.code, "invalid-timestamp");
  }
});

test("persistence mapper rejects incompatible schema versions", async () => {
  const run = await createRun("pending");
  const mapped = mapAnalysisRunToPersistenceRecord(run);
  assert.equal(mapped.status, "success");
  if (mapped.status !== "success") {
    return;
  }

  const restored = mapPersistenceRecordToAnalysisRun({
    ...mapped.value,
    schemaVersion: 99,
  });

  assert.equal(restored.status, "failure");
  if (restored.status === "failure") {
    assert.equal(
      restored.error.code,
      "incompatible-schema-version",
    );
  }
});

test("persistence mapper rejects missing required fields", async () => {
  const run = await createRun("pending");
  const mapped = mapAnalysisRunToPersistenceRecord(run);
  assert.equal(mapped.status, "success");
  if (mapped.status !== "success") {
    return;
  }

  const missingCreatorId: Partial<AnalysisRunPersistenceRecord> =
    structuredClone(mapped.value);
  Reflect.deleteProperty(missingCreatorId, "creatorId");
  const restored =
    mapPersistenceRecordToAnalysisRun(missingCreatorId);

  assert.equal(restored.status, "failure");
  if (restored.status === "failure") {
    assert.equal(restored.error.code, "missing-required-field");
  }
});

test("persistence mapper rejects corrupted and non-serializable records", async () => {
  const run = await createRun("pending");
  const mapped = mapAnalysisRunToPersistenceRecord(run);
  assert.equal(mapped.status, "success");
  if (mapped.status !== "success") {
    return;
  }

  const withUnknownField = {
    ...mapped.value,
    rawChannelData: { privateValue: "must-not-persist" },
  };
  const withUndefined = {
    ...mapped.value,
    source: {
      ...mapped.value.source,
      sourceReference: undefined,
    },
  };
  const sparseWarnings = new Array<
    AnalysisRunPersistenceRecord["adapterWarnings"][number]
  >(1);
  const withSparseArray = {
    ...mapped.value,
    adapterWarnings: sparseWarnings,
  };

  for (const candidate of [
    withUnknownField,
    withUndefined,
    withSparseArray,
  ]) {
    const restored = mapPersistenceRecordToAnalysisRun(candidate);
    assert.equal(restored.status, "failure");
    if (restored.status === "failure") {
      assert.equal(restored.error.code, "corrupted-record");
    }
  }
});

test("persistence mapper rejects payloads incompatible with status", async () => {
  const completed = await createRun("completed");
  const mapped = mapAnalysisRunToPersistenceRecord(completed);
  assert.equal(mapped.status, "success");
  if (mapped.status !== "success") {
    return;
  }

  const invalid = {
    ...mapped.value,
    status: "failed",
  } satisfies AnalysisRunPersistenceRecord;
  const restored = mapPersistenceRecordToAnalysisRun(invalid);

  assert.equal(restored.status, "failure");
  if (restored.status === "failure") {
    assert.equal(restored.error.code, "invalid-status-payload");
  }
});

test("persistence mapper is deterministic", async () => {
  const run = await createRun("completed");

  assert.deepEqual(
    mapAnalysisRunToPersistenceRecord(run),
    mapAnalysisRunToPersistenceRecord(run),
  );
});

test("persistence mapper minimizes private source and exception data", async () => {
  const run = await createRun("failed");
  const unsafeRuntimeValue = {
    ...run,
    rawChannelData: {
      apiKey: "private-api-key",
      accessToken: "private-access-token",
      refreshToken: "private-refresh-token",
      cookie: "private-cookie",
      authorization: "Bearer private-token",
      providerResponse: { payload: "private-provider-response" },
    },
    failure: {
      ...run.failure!,
      stack: "private-stack-trace",
      exception: new Error("private-exception"),
    },
  } as AnalysisRun;

  const mapped =
    mapAnalysisRunToPersistenceRecord(unsafeRuntimeValue);

  assert.equal(mapped.status, "success");
  if (mapped.status === "success") {
    const serialized = JSON.stringify(mapped.value);
    for (const privateValue of [
      "private-api-key",
      "private-access-token",
      "private-refresh-token",
      "private-cookie",
      "private-token",
      "private-provider-response",
      "private-stack-trace",
      "private-exception",
      "rawChannelData",
    ]) {
      assert.equal(serialized.includes(privateValue), false);
    }
  }
});
