import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FixtureChannelDataAdapter,
  fixtureChannelData,
} from "../../adapters";
import {
  CreatorIntelligenceAnalysisPipeline,
  type AnalysisResult,
  type CreatorAnalysisPipelineContext,
  type RawChannelData,
} from "../../engines";
import {
  AnalysisRunOrchestrator,
  type AnalysisRun,
  type AnalysisRunMutationOptions,
  type AnalysisRunRepositoryResult,
  type CompleteAnalysisRunInput,
} from "../../persistence";
import {
  PrismaAnalysisRunRepository,
} from "../../persistence/prisma";
import { AnalysisService } from "../../services";
import { TestClock } from "../fixtures/analysis-run-v2-fixtures";
import { FixedIdGenerator } from "../fixtures/core-fixtures";
import {
  createPostgresTestHarness,
  deleteOwnedPostgresTestRows,
} from "./postgres-test-harness";

const adapterTime = "2026-07-20T12:30:00.000Z";
const analysisTime = "2026-07-20T12:45:00.000Z";

function repositoryTimes(count = 24): ReadonlyArray<string> {
  const start = Date.parse("2026-07-20T13:00:00.000Z");
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 1_000).toISOString(),
  );
}

function createService(
  repository: PrismaAnalysisRunRepository,
  options?: {
    pipeline?: CreatorIntelligenceAnalysisPipeline;
    generatedId?: string;
  },
): AnalysisService<unknown> {
  const orchestrator = new AnalysisRunOrchestrator(
    new FixtureChannelDataAdapter(
      new TestClock([adapterTime]),
    ),
    repository,
    options?.pipeline ??
      new CreatorIntelligenceAnalysisPipeline(),
    new TestClock([analysisTime]),
    new FixedIdGenerator(
      options?.generatedId ?? "analysis_service",
    ),
  );
  return new AnalysisService(orchestrator, repository);
}

class ThrowingPipeline extends CreatorIntelligenceAnalysisPipeline {
  override run(
    _input: RawChannelData,
    _context: CreatorAnalysisPipelineContext,
  ): {
    analysis: AnalysisResult;
    completedStepIds: ReadonlyArray<string>;
  } {
    void _input;
    void _context;
    throw new Error("controlled pipeline test failure");
  }
}

class FailingCompleteRepository extends PrismaAnalysisRunRepository {
  override complete(
    analysisRunId: string,
    _input: CompleteAnalysisRunInput,
    _options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    void _input;
    void _options;
    return Promise.resolve({
      status: "failure",
      error: {
        code: "persistence-failure",
        message: "Controlled completion persistence failure.",
        analysisRunId,
      },
    });
  }
}

class FailingGetRepository extends PrismaAnalysisRunRepository {
  override getById(
    analysisRunId: string,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    return Promise.resolve({
      status: "failure",
      error: {
        code: "persistence-failure",
        message: "Controlled repository read failure.",
        analysisRunId,
      },
    });
  }
}

test("AnalysisService runs a complete fixture and returns the persisted AnalysisResult", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const result = await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_complete",
      correlationId: "service-complete",
    });

    assert.equal(result.status, "success");
    if (result.status === "success") {
      assert.equal(result.value.run.status, "completed");
      assert.equal(
        result.value.analysisResult.analysisId,
        "analysis_analysis_run_service_complete",
      );
      assert.deepEqual(
        result.value.analysisResult,
        result.value.run.analysisResult,
      );
    }

    const persisted = await harness.repository.getById(
      "analysis_run_service_complete",
    );
    assert.equal(persisted.status, "success");
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService preserves partial adapter warnings", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const result = await createService(
      harness.repository,
    ).runAnalysis({
      sourceData: fixtureChannelData.partial,
      creatorId: "creator_fixture_partial",
      channelId: "channel_fixture_partial",
      analysisRunId: "analysis_run_service_partial",
    });

    assert.equal(result.status, "success");
    if (result.status === "success") {
      assert.equal(result.value.adapterStatus, "partial");
      assert.ok(result.value.run.adapterWarnings.length > 0);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService gets a persisted run by identifier", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_get",
    });

    const result = await service.getAnalysis(
      "analysis_run_service_get",
    );
    assert.equal(result.status, "success");
    if (result.status === "success") {
      assert.equal(
        result.value.analysisRunId,
        "analysis_run_service_get",
      );
      assert.equal(result.value.status, "completed");
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService returns validation failures before persistence", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const result = await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: " ",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_invalid",
    });

    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "validation-failure");
      assert.equal(result.error.operation, "run-analysis");
    }
    const persisted = await harness.repository.getById(
      "analysis_run_service_invalid",
    );
    assert.equal(persisted.status, "failure");
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService propagates adapter failures with the safe failed run", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const result = await service.runAnalysis({
      sourceData: fixtureChannelData.invalidMetrics,
      creatorId: "creator_fixture_invalid",
      channelId: "channel_fixture_invalid",
      analysisRunId: "analysis_run_service_adapter_failure",
    });

    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "adapter-failure");
      assert.equal(result.error.stage, "adapter");
      assert.equal(result.error.persistedRun?.status, "failed");
      assert.equal(
        result.error.persistedRun?.analysisResult,
        undefined,
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService propagates pipeline failures without fabricating results", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository, {
      pipeline: new ThrowingPipeline(),
    });
    const result = await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_pipeline_failure",
    });

    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "pipeline-failure");
      assert.equal(result.error.stage, "pipeline");
      assert.equal(result.error.persistedRun?.status, "failed");
      assert.equal(
        result.error.persistedRun?.analysisResult,
        undefined,
      );
      assert.equal(
        result.error.message.includes(
          "controlled pipeline test failure",
        ),
        false,
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService leaves no partial AnalysisResult when completion persistence fails", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const repository = new FailingCompleteRepository(
      harness.owned.client,
      new TestClock(repositoryTimes()),
    );
    const service = createService(repository);
    const result = await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_rollback",
    });

    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "persistence-failure");
      assert.equal(result.error.stage, "persistence");
    }

    const persisted = await harness.repository.getById(
      "analysis_run_service_rollback",
    );
    assert.equal(persisted.status, "success");
    if (persisted.status === "success") {
      assert.equal(persisted.value.status, "processing");
      assert.equal(persisted.value.analysisResult, undefined);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService maps duplicate persistence failures without overwriting", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const input = {
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_duplicate",
    } as const;
    const first = await service.runAnalysis(input);
    const second = await service.runAnalysis(input);

    assert.equal(first.status, "success");
    assert.equal(second.status, "failure");
    if (second.status === "failure") {
      assert.equal(second.error.code, "persistence-failure");
      assert.equal(second.error.causeCode, "duplicate-id");
    }
    const persisted = await service.getAnalysis(
      "analysis_run_service_duplicate",
    );
    assert.equal(persisted.status, "success");
    if (persisted.status === "success") {
      assert.equal(persisted.value.revision, 3);
      assert.equal(persisted.value.status, "completed");
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("replayAnalysis creates a new run and preserves lineage and history", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const original = await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_original",
      correlationId: "service-replay",
      sourceReference: "fixture-complete",
    });
    assert.equal(original.status, "success");

    const replayed = await service.replayAnalysis({
      analysisRunId: "analysis_run_service_original",
      newAnalysisRunId: "analysis_run_service_replay",
      sourceData: fixtureChannelData.complete,
    });

    assert.equal(replayed.status, "success");
    if (replayed.status === "success") {
      assert.equal(
        replayed.value.replayedFromAnalysisRunId,
        "analysis_run_service_original",
      );
      assert.equal(replayed.value.run.attempt, 2);
      assert.equal(
        replayed.value.run.retryOfAnalysisRunId,
        "analysis_run_service_original",
      );
      assert.equal(
        replayed.value.run.correlationId,
        "service-replay",
      );
      assert.equal(
        replayed.value.run.source.sourceReference,
        "fixture-complete",
      );
    }

    const history = await service.listAnalysisRuns({
      channelId: "channel_fixture_complete",
      limit: 10,
    });
    assert.equal(history.status, "success");
    if (history.status === "success") {
      assert.deepEqual(
        history.value.items.map((run) => run.analysisRunId),
        [
          "analysis_run_service_replay",
          "analysis_run_service_original",
        ],
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("replayAnalysis returns not-found and does not create history", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const result = await service.replayAnalysis({
      analysisRunId: "analysis_run_service_missing",
      newAnalysisRunId: "analysis_run_service_never_created",
      sourceData: fixtureChannelData.complete,
    });

    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "not-found");
      assert.equal(result.error.operation, "replay-analysis");
    }
    const missing = await harness.repository.getById(
      "analysis_run_service_never_created",
    );
    assert.equal(missing.status, "failure");
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("listAnalysisRuns exposes chronological pagination and status filters", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    for (const analysisRunId of [
      "analysis_run_service_history_1",
      "analysis_run_service_history_2",
      "analysis_run_service_history_3",
    ]) {
      const result = await service.runAnalysis({
        sourceData: fixtureChannelData.complete,
        creatorId: "creator_fixture_complete",
        channelId: "channel_fixture_complete",
        analysisRunId,
      });
      assert.equal(result.status, "success");
    }

    const first = await service.listAnalysisRuns({
      channelId: "channel_fixture_complete",
      limit: 2,
      status: "completed",
    });
    assert.equal(first.status, "success");
    if (first.status !== "success") {
      return;
    }
    assert.deepEqual(
      first.value.items.map((run) => run.analysisRunId),
      [
        "analysis_run_service_history_3",
        "analysis_run_service_history_2",
      ],
    );
    assert.ok(first.value.nextCursor);

    const second = await service.listAnalysisRuns({
      channelId: "channel_fixture_complete",
      limit: 2,
      status: "completed",
      cursor: first.value.nextCursor ?? undefined,
    });
    assert.equal(second.status, "success");
    if (second.status === "success") {
      assert.deepEqual(
        second.value.items.map((run) => run.analysisRunId),
        ["analysis_run_service_history_1"],
      );
      assert.equal(second.value.nextCursor, null);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("deleteAnalysis removes one explicit persisted run", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const created = await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_delete",
    });
    assert.equal(created.status, "success");
    if (created.status !== "success") {
      return;
    }

    const deleted = await service.deleteAnalysis(
      created.value.analysisRunId,
      { expectedRevision: created.value.run.revision },
    );
    assert.equal(deleted.status, "success");

    const missing = await service.getAnalysis(
      created.value.analysisRunId,
    );
    assert.equal(missing.status, "failure");
    if (missing.status === "failure") {
      assert.equal(missing.error.code, "not-found");
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("deleteAnalysis propagates optimistic concurrency without deleting", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const service = createService(harness.repository);
    const created = await service.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_concurrency",
    });
    assert.equal(created.status, "success");
    if (created.status !== "success") {
      return;
    }

    const deleted = await service.deleteAnalysis(
      created.value.analysisRunId,
      { expectedRevision: 1 },
    );
    assert.equal(deleted.status, "failure");
    if (deleted.status === "failure") {
      assert.equal(
        deleted.error.code,
        "concurrency-conflict",
      );
      assert.equal(deleted.error.expectedRevision, 1);
      assert.equal(
        deleted.error.actualRevision,
        created.value.run.revision,
      );
    }

    const persisted = await service.getAnalysis(
      created.value.analysisRunId,
    );
    assert.equal(persisted.status, "success");
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("constructor injection allows independent services to share an explicit repository", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const writer = createService(harness.repository, {
      generatedId: "service_writer",
    });
    const reader = createService(harness.repository, {
      generatedId: "service_reader",
    });

    const created = await writer.runAnalysis({
      sourceData: fixtureChannelData.complete,
      creatorId: "creator_fixture_complete",
      channelId: "channel_fixture_complete",
      analysisRunId: "analysis_run_service_injected",
    });
    assert.equal(created.status, "success");

    const retrieved = await reader.getAnalysis(
      "analysis_run_service_injected",
    );
    assert.equal(retrieved.status, "success");
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("AnalysisService maps a repository read failure to a contextual failure", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const repository = new FailingGetRepository(
      harness.owned.client,
      new TestClock(repositoryTimes()),
    );
    const result = await createService(
      repository,
    ).getAnalysis("analysis_run_service_repository_failure");

    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "repository-failure");
      assert.equal(result.error.operation, "get-analysis");
      assert.equal(
        result.error.causeCode,
        "persistence-failure",
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});
