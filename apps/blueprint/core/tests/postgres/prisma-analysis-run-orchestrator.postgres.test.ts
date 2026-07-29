import assert from "node:assert/strict";
import { test } from "node:test";

import { FixtureChannelDataAdapter, fixtureChannelData } from "../../adapters";
import { CreatorIntelligenceAnalysisPipeline } from "../../engines";
import { AnalysisRunOrchestrator } from "../../persistence";
import { PrismaAnalysisRunRepository } from "../../persistence/prisma";
import { FixedIdGenerator } from "../fixtures/core-fixtures";
import { TestClock } from "../fixtures/analysis-run-v2-fixtures";
import {
  createPostgresTestHarness,
  deleteOwnedPostgresTestRows,
} from "./postgres-test-harness";

const repositoryTimes = [
  "2026-07-20T13:00:00.000Z",
  "2026-07-20T13:00:01.000Z",
  "2026-07-20T13:00:02.000Z",
] as const;

test("orchestrator persists a completed analysis through Prisma into PostgreSQL", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes),
  );
  try {
    const repository = new PrismaAnalysisRunRepository(
      harness.owned.client,
      new TestClock(repositoryTimes),
    );
    const orchestrator = new AnalysisRunOrchestrator(
      new FixtureChannelDataAdapter(
        new TestClock(["2026-07-20T12:30:00.000Z"]),
      ),
      repository,
      new CreatorIntelligenceAnalysisPipeline(),
      new TestClock(["2026-07-20T12:45:00.000Z"]),
      new FixedIdGenerator("postgres_orchestrator"),
    );
    const result = await orchestrator.execute({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      correlationId: "postgres-integration",
    });

    assert.equal(result.status, "completed");
    const persisted = await repository.getById(
      "analysis_run_postgres_orchestrator",
    );
    assert.equal(persisted.status, "success");
    if (persisted.status === "success") {
      assert.equal(persisted.value.status, "completed");
      assert.ok(persisted.value.analysisResult);
      assert.equal(persisted.value.correlationId, "postgres-integration");
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("orchestrator preserves partial adapter warnings in PostgreSQL", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes),
  );
  try {
    const orchestrator = new AnalysisRunOrchestrator(
      new FixtureChannelDataAdapter(
        new TestClock(["2026-07-20T12:30:00.000Z"]),
      ),
      harness.repository,
      new CreatorIntelligenceAnalysisPipeline(),
      new TestClock(["2026-07-20T12:45:00.000Z"]),
      new FixedIdGenerator("postgres_partial"),
    );
    const result = await orchestrator.execute({
      sourceData: fixtureChannelData.partial,
      creatorId: "creator_fixture_partial",
      channelId: "channel_fixture_partial",
    });

    assert.equal(result.status, "completed");
    if (result.status === "completed") {
      assert.equal(result.adapterStatus, "partial");
      assert.ok(result.run.adapterWarnings.length > 0);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("orchestrator persists failures without fabricated analysis results", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes),
  );
  try {
    const orchestrator = new AnalysisRunOrchestrator(
      new FixtureChannelDataAdapter(
        new TestClock(["2026-07-20T12:30:00.000Z"]),
      ),
      harness.repository,
      new CreatorIntelligenceAnalysisPipeline(),
      new TestClock(["2026-07-20T12:45:00.000Z"]),
      new FixedIdGenerator("postgres_failure"),
    );
    const result = await orchestrator.execute({
      sourceData: fixtureChannelData.invalidMetrics,
      creatorId: "creator_fixture_invalid",
      channelId: "channel_fixture_invalid",
    });

    assert.equal(result.status, "failed");
    const persisted = await harness.repository.getById(
      "analysis_run_postgres_failure",
    );
    assert.equal(persisted.status, "success");
    if (persisted.status === "success") {
      assert.equal(persisted.value.status, "failed");
      assert.equal(persisted.value.analysisResult, undefined);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});
