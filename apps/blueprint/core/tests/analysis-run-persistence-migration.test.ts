import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CurrentAnalysisRunPersistenceRecordMigrator,
  InMemoryAnalysisRunRepository,
  mapAnalysisRunToPersistenceRecord,
} from "../persistence";
import {
  TestClock,
  baseAnalysisRunInput,
} from "./fixtures/analysis-run-v2-fixtures";

async function createCurrentRecord() {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const created = await repository.create(baseAnalysisRunInput);
  assert.equal(created.status, "success");
  if (created.status !== "success") {
    return assert.fail("Could not create migration fixture.");
  }
  const mapped = mapAnalysisRunToPersistenceRecord(created.value);
  assert.equal(mapped.status, "success");
  return mapped.status === "success"
    ? mapped.value
    : assert.fail("Could not map migration fixture.");
}

test("migration boundary validates current records without migrating them", async () => {
  const record = await createCurrentRecord();
  const migrator =
    new CurrentAnalysisRunPersistenceRecordMigrator();
  const result = migrator.migrate(record, 2);

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.migrated, false);
    assert.deepEqual(result.record, record);
  }
});

test("migration boundary does not convert unknown source versions", async () => {
  const record = await createCurrentRecord();
  const migrator =
    new CurrentAnalysisRunPersistenceRecordMigrator();
  const result = migrator.migrate(
    {
      ...record,
      schemaVersion: 1,
    },
    2,
  );

  assert.equal(result.status, "failure");
  if (result.status === "failure") {
    assert.equal(result.error.code, "migration-unavailable");
  }
});

test("migration boundary rejects unsupported targets and corrupt current records", async () => {
  const record = await createCurrentRecord();
  const migrator =
    new CurrentAnalysisRunPersistenceRecordMigrator();
  const unsupportedTarget = migrator.migrate(record, 3);
  const corrupted = migrator.migrate(
    {
      ...record,
      createdAt: "invalid",
    },
    2,
  );

  assert.equal(unsupportedTarget.status, "failure");
  if (unsupportedTarget.status === "failure") {
    assert.equal(
      unsupportedTarget.error.code,
      "unsupported-target-version",
    );
  }
  assert.equal(corrupted.status, "failure");
  if (corrupted.status === "failure") {
    assert.equal(corrupted.error.code, "invalid-source-record");
  }
});
