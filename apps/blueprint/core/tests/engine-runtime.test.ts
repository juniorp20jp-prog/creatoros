import assert from "node:assert/strict";
import { test } from "node:test";

import { EngineRegistry } from "../engines/engine-registry";
import { EngineRuntime } from "../services/engine-runtime";
import {
  FixedIdGenerator,
  SequenceClock,
  TEST_ENGINE_ID,
  createTestRuntime,
  type TestEngineContracts,
} from "./fixtures/core-fixtures";

test("EngineRuntime executes a registered engine", async () => {
  const { runtime } = createTestRuntime();

  const result = await runtime.execute(TEST_ENGINE_ID, { value: 4 });

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.value, 8);
  }
});

test("EngineRuntime constructs and propagates execution context", async () => {
  const { runtime } = createTestRuntime({
    clock: new SequenceClock([
      "2026-07-20T12:00:00.000Z",
      "2026-07-20T12:00:01.000Z",
    ]),
    idGenerator: new FixedIdGenerator("runtime"),
  });

  const result = await runtime.execute(
    TEST_ENGINE_ID,
    { value: 1 },
    {
      locale: "pt-BR",
      correlationId: "correlation_test",
      attributes: { source: "automated-test" },
    },
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.deepEqual(result.output.context, {
      executionId: "exec_runtime",
      engineId: TEST_ENGINE_ID,
      startedAt: "2026-07-20T12:00:00.000Z",
      locale: "pt-BR",
      correlationId: "correlation_test",
      attributes: { source: "automated-test" },
    });
  }
});

test("EngineRuntime propagates timestamps and execution metadata", async () => {
  const { runtime } = createTestRuntime({
    clock: new SequenceClock([
      "2026-07-20T12:00:00.000Z",
      "2026-07-20T12:00:05.000Z",
    ]),
    idGenerator: new FixedIdGenerator("metadata"),
  });

  const result = await runtime.execute(TEST_ENGINE_ID, { value: 2 });

  assert.deepEqual(result.metadata, {
    executionId: "exec_metadata",
    engineId: TEST_ENGINE_ID,
    startedAt: "2026-07-20T12:00:00.000Z",
    finishedAt: "2026-07-20T12:00:05.000Z",
    providerIds: ["test-provider"],
    completedStepIds: ["test-step"],
  });
});

test("EngineRuntime returns a discriminated failed result", async () => {
  const { runtime } = createTestRuntime();

  const result = await runtime.execute(TEST_ENGINE_ID, {
    value: 1,
    shouldFail: true,
  });

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.error.code, "TEST_ENGINE_FAILURE");
    assert.equal(result.error.retryable, false);
  }
});

test("EngineRuntime controls execution of a missing engine", () => {
  const registry = new EngineRegistry<TestEngineContracts>();
  const runtime = new EngineRuntime(registry);

  assert.throws(
    () => runtime.execute(TEST_ENGINE_ID, { value: 1 }),
    /Intelligence engine "test-engine" is not registered/,
  );
});
