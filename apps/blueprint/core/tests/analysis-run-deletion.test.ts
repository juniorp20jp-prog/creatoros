import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InMemoryAnalysisRunRepository,
} from "../persistence";
import {
  TestClock,
  baseAnalysisRunInput,
} from "./fixtures/analysis-run-v2-fixtures";

test("deleteById removes one explicit analysis run", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const created = await repository.create(baseAnalysisRunInput);
  assert.equal(created.status, "success");
  if (created.status !== "success") {
    return;
  }

  const deleted = await repository.deleteById(
    created.value.analysisRunId,
    { expectedRevision: created.value.revision },
  );
  const read = await repository.getById(
    created.value.analysisRunId,
  );

  assert.equal(deleted.status, "success");
  if (deleted.status === "success") {
    assert.deepEqual(deleted.value, created.value);
  }
  assert.equal(read.status, "failure");
  if (read.status === "failure") {
    assert.equal(read.error.code, "not-found");
  }
});

test("deleteById returns not-found for an unknown id", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const deleted = await repository.deleteById("missing");

  assert.equal(deleted.status, "failure");
  if (deleted.status === "failure") {
    assert.equal(deleted.error.code, "not-found");
  }
});

test("deleteById rejects a stale revision without deleting", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  const created = await repository.create(baseAnalysisRunInput);
  assert.equal(created.status, "success");
  if (created.status !== "success") {
    return;
  }

  const deleted = await repository.deleteById(
    created.value.analysisRunId,
    { expectedRevision: 99 },
  );
  const read = await repository.getById(
    created.value.analysisRunId,
  );

  assert.equal(deleted.status, "failure");
  if (deleted.status === "failure") {
    assert.equal(deleted.error.code, "concurrency-conflict");
  }
  assert.equal(read.status, "success");
});

test("deleteMany removes only the explicit unique identifiers", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  for (const analysisRunId of ["delete_a", "delete_b", "keep_c"]) {
    const created = await repository.create({
      ...baseAnalysisRunInput,
      analysisRunId,
    });
    assert.equal(created.status, "success");
  }

  const deleted = await repository.deleteMany({
    analysisRunIds: ["delete_b", "delete_a"],
    expectedRevisions: {
      delete_a: 1,
      delete_b: 1,
    },
  });

  assert.equal(deleted.status, "success");
  if (deleted.status === "success") {
    assert.deepEqual(
      deleted.value.map((run) => run.analysisRunId),
      ["delete_b", "delete_a"],
    );
  }
  assert.equal((await repository.getById("delete_a")).status, "failure");
  assert.equal((await repository.getById("delete_b")).status, "failure");
  assert.equal((await repository.getById("keep_c")).status, "success");
});

test("deleteMany is atomic when an id or revision is invalid", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  for (const analysisRunId of ["atomic_a", "atomic_b"]) {
    await repository.create({
      ...baseAnalysisRunInput,
      analysisRunId,
    });
  }

  const missing = await repository.deleteMany({
    analysisRunIds: ["atomic_a", "missing"],
  });
  const conflict = await repository.deleteMany({
    analysisRunIds: ["atomic_a", "atomic_b"],
    expectedRevisions: {
      atomic_a: 1,
      atomic_b: 99,
    },
  });

  assert.equal(missing.status, "failure");
  assert.equal(conflict.status, "failure");
  if (conflict.status === "failure") {
    assert.equal(conflict.error.code, "concurrency-conflict");
  }
  assert.equal((await repository.getById("atomic_a")).status, "success");
  assert.equal((await repository.getById("atomic_b")).status, "success");
});

test("deleteMany rejects empty, duplicate, and broad revision inputs", async () => {
  const repository = new InMemoryAnalysisRunRepository(
    new TestClock(),
  );
  await repository.create(baseAnalysisRunInput);

  const empty = await repository.deleteMany({
    analysisRunIds: [],
  });
  const duplicate = await repository.deleteMany({
    analysisRunIds: ["analysis_run_test", "analysis_run_test"],
  });
  const broad = await repository.deleteMany({
    analysisRunIds: ["analysis_run_test"],
    expectedRevisions: {
      analysis_run_test: 1,
      unrelated_run: 1,
    },
  });

  for (const result of [empty, duplicate, broad]) {
    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "invalid-query");
    }
  }
  assert.equal(
    (await repository.getById("analysis_run_test")).status,
    "success",
  );
});
