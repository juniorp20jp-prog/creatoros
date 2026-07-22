import assert from "node:assert/strict";
import { test } from "node:test";

import { EngineRegistry } from "../engines/engine-registry";
import {
  TEST_ENGINE_ID,
  TestEngine,
  type TestEngineContracts,
} from "./fixtures/core-fixtures";

test("EngineRegistry registers a valid engine", () => {
  const registry = new EngineRegistry<TestEngineContracts>();

  registry.register(new TestEngine());

  assert.equal(registry.has(TEST_ENGINE_ID), true);
  assert.deepEqual(registry.list(), [
    {
      id: TEST_ENGINE_ID,
      name: "Test Engine",
      version: "1.0.0",
      capabilities: ["testing"],
    },
  ]);
});

test("EngineRegistry resolves an engine by its identifier", () => {
  const registry = new EngineRegistry<TestEngineContracts>();
  const engine = new TestEngine();
  registry.register(engine);

  assert.equal(registry.resolve(TEST_ENGINE_ID), engine);
});

test("EngineRegistry rejects duplicate identifiers", () => {
  const registry = new EngineRegistry<TestEngineContracts>();
  registry.register(new TestEngine());

  assert.throws(
    () => registry.register(new TestEngine()),
    /already registered/,
  );
});

test("EngineRegistry returns a clear error for a missing engine", () => {
  const registry = new EngineRegistry<TestEngineContracts>();

  assert.throws(
    () => registry.resolve(TEST_ENGINE_ID),
    /Intelligence engine "test-engine" is not registered/,
  );
});
