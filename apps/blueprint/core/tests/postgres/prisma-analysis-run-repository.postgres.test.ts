import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANALYSIS_RUN_SCHEMA_VERSION,
  planAnalysisRunRetention,
} from "../../persistence";
import {
  createAnalysisRunPrismaClient,
  PrismaAnalysisRunRepository,
} from "../../persistence/prisma";
import { runAnalysisRunRepositoryContractTests } from "../fixtures/analysis-run-repository-contract";
import {
  baseAnalysisRunInput,
  TestClock,
} from "../fixtures/analysis-run-v2-fixtures";
import {
  createPostgresTestHarness,
  deleteOwnedPostgresTestRows,
  requireTestDatabaseUrl,
} from "./postgres-test-harness";

const repositoryTimes = [
  "2026-07-20T13:00:00.000Z",
  "2026-07-20T13:00:01.000Z",
  "2026-07-20T13:00:02.000Z",
] as const;

runAnalysisRunRepositoryContractTests(
  "PrismaAnalysisRunRepository/PostgreSQL",
  async (clock) => {
    const harness = await createPostgresTestHarness(clock);
    return {
      repository: harness.repository,
      cleanup: async () => {
        await deleteOwnedPostgresTestRows(harness.owned);
        await harness.owned.disconnect();
      },
    };
  },
);

test("PostgreSQL persists a run across client and repository instances", async () => {
  const first = await createPostgresTestHarness(new TestClock(repositoryTimes));
  const created = await first.repository.create({
    ...baseAnalysisRunInput,
    analysisRunId: "postgres_restart",
  });
  assert.equal(created.status, "success");
  await first.owned.disconnect();

  const secondOwned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  try {
    const secondRepository = new PrismaAnalysisRunRepository(
      secondOwned.client,
      new TestClock(repositoryTimes),
    );
    const reloaded = await secondRepository.getById("postgres_restart");
    assert.equal(reloaded.status, "success");
    if (created.status === "success" && reloaded.status === "success") {
      assert.deepEqual(reloaded.value, created.value);
    }
  } finally {
    await deleteOwnedPostgresTestRows(secondOwned);
    await secondOwned.disconnect();
  }
});

test("PostgreSQL compare-and-swap permits exactly one conflicting transition", async () => {
  const first = await createPostgresTestHarness(new TestClock(repositoryTimes));
  const secondOwned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  try {
    const second = new PrismaAnalysisRunRepository(
      secondOwned.client,
      new TestClock(repositoryTimes),
    );
    const created = await first.repository.create({
      ...baseAnalysisRunInput,
      analysisRunId: "postgres_race",
    });
    assert.equal(created.status, "success");
    if (created.status !== "success") {
      return;
    }

    const results = await Promise.all([
      first.repository.updateStatus(created.value.analysisRunId, "processing", {
        expectedRevision: created.value.revision,
      }),
      second.updateStatus(created.value.analysisRunId, "processing", {
        expectedRevision: created.value.revision,
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === "success").length,
      1,
    );
    const rejected = results.find((result) => result.status === "failure");
    assert.equal(rejected?.status, "failure");
    if (rejected?.status === "failure") {
      assert.equal(rejected.error.code, "concurrency-conflict");
    }
  } finally {
    await deleteOwnedPostgresTestRows(first.owned);
    await first.owned.disconnect();
    await secondOwned.disconnect();
  }
});

test("PostgreSQL batch deletion is atomic when one revision conflicts", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes),
  );
  try {
    const first = await harness.repository.create({
      ...baseAnalysisRunInput,
      analysisRunId: "postgres_batch_a",
    });
    const second = await harness.repository.create({
      ...baseAnalysisRunInput,
      analysisRunId: "postgres_batch_b",
    });
    assert.equal(first.status, "success");
    assert.equal(second.status, "success");
    if (first.status !== "success" || second.status !== "success") {
      return;
    }
    await harness.repository.updateStatus(
      second.value.analysisRunId,
      "processing",
      { expectedRevision: second.value.revision },
    );

    const deleted = await harness.repository.deleteMany({
      analysisRunIds: [first.value.analysisRunId, second.value.analysisRunId],
      expectedRevisions: {
        [first.value.analysisRunId]: first.value.revision,
        [second.value.analysisRunId]: second.value.revision,
      },
    });
    assert.equal(deleted.status, "failure");
    if (deleted.status === "failure") {
      assert.equal(deleted.error.code, "concurrency-conflict");
    }

    assert.equal(
      (await harness.repository.getById(first.value.analysisRunId)).status,
      "success",
    );
    assert.equal(
      (await harness.repository.getById(second.value.analysisRunId)).status,
      "success",
    );
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("PostgreSQL maps incompatible and corrupt rows to typed safe failures", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes),
  );
  try {
    const baseRow = {
      creatorId: "creator_test_corruption",
      channelId: "channel_test",
      status: "pending",
      revision: 1,
      adapterWarnings: [],
      pipelineVersion: "1.0.0",
      attempt: 1,
      createdAt: new Date(repositoryTimes[0]),
      updatedAt: new Date(repositoryTimes[0]),
    } as const;
    await harness.owned.client.analysisRunRow.create({
      data: {
        ...baseRow,
        analysisRunId: "postgres_incompatible",
        schemaVersion: 99,
        source: {
          sourceType: "local-fixture",
          sourceSchemaVersion: "1",
        },
      },
    });
    await harness.owned.client.analysisRunRow.create({
      data: {
        ...baseRow,
        analysisRunId: "postgres_corrupt",
        schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
        source: {},
      },
    });

    const incompatible = await harness.repository.getById(
      "postgres_incompatible",
    );
    const corrupt = await harness.repository.getById("postgres_corrupt");
    assert.equal(incompatible.status, "failure");
    assert.equal(corrupt.status, "failure");
    if (incompatible.status === "failure") {
      assert.equal(incompatible.error.code, "version-incompatibility");
    }
    if (corrupt.status === "failure") {
      assert.equal(corrupt.error.code, "persistence-failure");
      assert.equal(
        JSON.stringify(corrupt).includes(requireTestDatabaseUrl()),
        false,
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("PostgreSQL rows contain normalized metadata and no raw provider payload", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes),
  );
  try {
    const created = await harness.repository.create({
      ...baseAnalysisRunInput,
      analysisRunId: "postgres_privacy",
      source: {
        sourceType: "privacy-fixture",
        sourceSchemaVersion: "1",
        sourceReference: "opaque-reference",
      },
    });
    assert.equal(created.status, "success");
    const row = await harness.owned.client.analysisRunRow.findUnique({
      where: { analysisRunId: "postgres_privacy" },
    });
    assert.ok(row);
    const serialized = JSON.stringify(row);
    assert.equal(serialized.includes("rawPayload"), false);
    assert.equal(serialized.includes("accessToken"), false);
    assert.equal(serialized.includes("apiKey"), false);
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("retention plans remain pure until explicit PostgreSQL deletion", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes),
  );
  try {
    for (const analysisRunId of [
      "postgres_retention_old",
      "postgres_retention_new",
    ]) {
      const created = await harness.repository.create({
        ...baseAnalysisRunInput,
        analysisRunId,
      });
      assert.equal(created.status, "success");
    }
    const history = await harness.repository.listByChannel({
      channelId: baseAnalysisRunInput.channelId,
    });
    assert.equal(history.status, "success");
    if (history.status !== "success") {
      return;
    }

    const planned = planAnalysisRunRetention(
      history.value.items,
      { kind: "max-runs-per-channel", maxRuns: 1 },
      {
        evaluatedAt: "2026-07-20T14:00:00.000Z",
        dryRun: true,
      },
    );
    assert.equal(planned.status, "success");
    if (planned.status !== "success") {
      return;
    }
    assert.equal(planned.plan.deletionCandidates.length, 1);
    const candidateId = planned.plan.deletionCandidates[0]!.analysisRunId;

    const stillPresent = await harness.repository.getById(candidateId);
    assert.equal(stillPresent.status, "success");

    const deleted = await harness.repository.deleteMany({
      analysisRunIds: [candidateId],
      expectedRevisions: {
        [candidateId]: history.value.items.find(
          (run) => run.analysisRunId === candidateId,
        )!.revision,
      },
    });
    assert.equal(deleted.status, "success");
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});
