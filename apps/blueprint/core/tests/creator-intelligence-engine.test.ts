import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREATOR_INTELLIGENCE_ENGINE_ID,
  CreatorIntelligenceEngine,
} from "../engines/creator-intelligence";
import { EngineRegistry } from "../engines/engine-registry";
import type { CoreEngineContracts } from "../runtime";
import {
  DefaultExecutionContextFactory,
  EngineRuntime,
} from "../services";
import {
  FixedIdGenerator,
  SequenceClock,
  creatorInputWithSources,
  creatorInputWithoutSources,
} from "./fixtures/core-fixtures";

function createCreatorRuntime() {
  const registry = new EngineRegistry<CoreEngineContracts>();
  registry.register(new CreatorIntelligenceEngine());

  return new EngineRuntime(registry);
}

test("Creator Intelligence Engine returns awaiting-sources without sources", async () => {
  const result = await createCreatorRuntime().execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    creatorInputWithoutSources,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.readiness, "awaiting-sources");
  }
});

test("Creator Intelligence Engine returns ready-for-providers with sources", async () => {
  const result = await createCreatorRuntime().execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    creatorInputWithSources,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.readiness, "ready-for-providers");
    assert.deepEqual(result.metadata.providerIds, ["provider_test"]);
  }
});

test("Creator Intelligence Engine does not generate fictional intelligence", async () => {
  const result = await createCreatorRuntime().execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    creatorInputWithSources,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.deepEqual(result.output.signals, []);
    assert.deepEqual(result.output.recommendations, []);
  }
});

test("Creator Intelligence Engine preserves creator context and objective", async () => {
  const result = await createCreatorRuntime().execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    creatorInputWithoutSources,
  );

  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal("creator" in result.output, true);
    assert.equal("objective" in result.output, true);

    if ("creator" in result.output && "objective" in result.output) {
      assert.deepEqual(result.output.creator, creatorInputWithoutSources.creator);
      assert.deepEqual(
        result.output.objective,
        creatorInputWithoutSources.objective,
      );
    }
  }
});

test("Creator Intelligence Engine uses injected clock and identifiers deterministically", async () => {
  const registry = new EngineRegistry<CoreEngineContracts>();
  registry.register(new CreatorIntelligenceEngine());
  const runtime = new EngineRuntime(
    registry,
    new DefaultExecutionContextFactory(
      new SequenceClock([
        "2026-07-20T13:00:00.000Z",
        "2026-07-20T13:00:02.000Z",
      ]),
      new FixedIdGenerator("creator"),
    ),
  );

  const result = await runtime.execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    creatorInputWithoutSources,
  );

  assert.deepEqual(result.metadata, {
    executionId: "exec_creator",
    engineId: CREATOR_INTELLIGENCE_ENGINE_ID,
    startedAt: "2026-07-20T13:00:00.000Z",
    finishedAt: "2026-07-20T13:00:02.000Z",
    providerIds: [],
    completedStepIds: [],
  });
});

test("Creator Intelligence Engine returns failed for invalid input", async () => {
  const result = await createCreatorRuntime().execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    {
      ...creatorInputWithoutSources,
      creator: {
        ...creatorInputWithoutSources.creator,
        creatorId: "  ",
      },
    },
  );

  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.error.code, "CREATOR_INTELLIGENCE_EXECUTION_FAILED");
    assert.match(result.error.message, /creator\.creatorId/);
  }
});
