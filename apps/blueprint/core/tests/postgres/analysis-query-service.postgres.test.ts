import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  FixtureChannelDataAdapter,
  fixtureChannelData,
  type FixtureChannelDataSource,
} from "../../adapters";
import {
  createAnalysisCoreComposition,
} from "../../composition";
import {
  CreatorIntelligenceAnalysisPipeline,
} from "../../engines";
import {
  AnalysisRunOrchestrator,
} from "../../persistence";
import {
  PrismaAnalysisRunRepository,
} from "../../persistence/prisma";
import {
  AnalysisQueryService,
  AnalysisService,
  mapAnalysisRunToDetails,
  mapAnalysisRunToHistoryItem,
  mapAnalysisRunToSummary,
} from "../../services";
import { TestClock } from "../fixtures/analysis-run-v2-fixtures";
import { FixedIdGenerator } from "../fixtures/core-fixtures";
import {
  createPostgresTestHarness,
  deleteOwnedPostgresTestRows,
  requireTestDatabaseUrl,
} from "./postgres-test-harness";

const queryTime = "2026-07-20T18:00:00.000Z";
const adapterTime = "2026-07-20T12:30:00.000Z";
const analysisTime = "2026-07-20T12:45:00.000Z";

const partialSameChannel: FixtureChannelDataSource = {
  schemaVersion: FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  collectedAt: "2026-07-20T12:00:00.000Z",
  creator: {
    creatorId: "creator_fixture_complete",
  },
  channel: {
    channelId: "channel_fixture_complete",
    ownerCreatorId: "creator_fixture_complete",
    subscriberCount: 1_000,
  },
  videos: [
    {
      videoId: "query_partial_video",
      publishedAt: "2026-07-10T12:00:00.000Z",
      viewCount: 75,
    },
  ],
};

const invalidSameChannel: FixtureChannelDataSource = {
  ...fixtureChannelData.complete,
  channel: {
    ...fixtureChannelData.complete.channel,
    subscriberCount: -1,
  },
};

function repositoryTimes(count = 80): ReadonlyArray<string> {
  const start = Date.parse("2026-07-20T13:00:00.000Z");
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 1_000).toISOString(),
  );
}

function createServices(
  repository: PrismaAnalysisRunRepository,
  queryClock: TestClock = new TestClock([queryTime]),
): {
  analysisService: AnalysisService<unknown>;
  queryService: AnalysisQueryService;
} {
  const orchestrator = new AnalysisRunOrchestrator(
    new FixtureChannelDataAdapter(
      new TestClock([adapterTime]),
    ),
    repository,
    new CreatorIntelligenceAnalysisPipeline(),
    new TestClock([analysisTime]),
    new FixedIdGenerator("analysis_query"),
  );
  return {
    analysisService: new AnalysisService(
      orchestrator,
      repository,
    ),
    queryService: new AnalysisQueryService(
      repository,
      queryClock,
    ),
  };
}

async function seedRun(
  service: AnalysisService<unknown>,
  analysisRunId: string,
  sourceData: unknown = fixtureChannelData.complete,
): Promise<void> {
  const result = await service.runAnalysis({
    sourceData,
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
    analysisRunId,
  });
  assert.equal(
    result.status,
    sourceData === invalidSameChannel
      ? "failure"
      : "success",
  );
}

test("getAnalysisById returns AnalysisDetails instead of a persistence entity", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_details",
    );

    const result = await queryService.getAnalysisById(
      "analysis_run_query_details",
    );
    assert.equal(result.status, "success");
    if (result.status === "success") {
      assert.equal(
        result.value.summary.analysisRunId,
        "analysis_run_query_details",
      );
      assert.equal(result.value.summary.status, "completed");
      assert.ok(result.value.analysisResult);
      assert.equal("revision" in result.value, false);
      assert.equal("adapterWarnings" in result.value, false);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("listAnalysisRuns uses deterministic cursor pagination", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    for (const id of [
      "analysis_run_query_page_1",
      "analysis_run_query_page_2",
      "analysis_run_query_page_3",
    ]) {
      await seedRun(analysisService, id);
    }

    const first = await queryService.listAnalysisRuns({
      filters: {
        channelId: "channel_fixture_complete",
      },
      pageSize: 2,
    });
    assert.equal(first.status, "success");
    if (first.status !== "success") {
      return;
    }
    assert.deepEqual(
      first.value.items.map((item) => item.analysisRunId),
      [
        "analysis_run_query_page_3",
        "analysis_run_query_page_2",
      ],
    );
    assert.equal(first.value.cursor.hasNextPage, true);
    assert.ok(first.value.cursor.nextCursor);

    const second = await queryService.listAnalysisRuns({
      filters: {
        channelId: "channel_fixture_complete",
      },
      pageSize: 2,
      cursor: first.value.cursor.nextCursor ?? undefined,
    });
    assert.equal(second.status, "success");
    if (second.status === "success") {
      assert.deepEqual(
        second.value.items.map(
          (item) => item.analysisRunId,
        ),
        ["analysis_run_query_page_1"],
      );
      assert.equal(second.value.cursor.nextCursor, null);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("listAnalysisRuns applies creator, date, attempt, and analysis ID filters", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_filter_original",
    );
    const replay = await analysisService.replayAnalysis({
      analysisRunId:
        "analysis_run_query_filter_original",
      newAnalysisRunId:
        "analysis_run_query_filter_replay",
      sourceData: fixtureChannelData.complete,
    });
    assert.equal(replay.status, "success");

    const result = await queryService.listAnalysisRuns({
      filters: {
        channelId: "channel_fixture_complete",
        creatorId: "creator_fixture_complete",
        createdFrom: "2026-07-20T13:00:00.000Z",
        createdTo: "2026-07-20T13:01:00.000Z",
        attempt: 2,
        analysisId:
          "analysis_analysis_run_query_filter_replay",
      },
      pageSize: 10,
    });
    assert.equal(result.status, "success");
    if (result.status === "success") {
      assert.deepEqual(
        result.value.items.map(
          (item) => item.analysisRunId,
        ),
        ["analysis_run_query_filter_replay"],
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("listLatestAnalysis returns the newest matching read model", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_latest_1",
    );
    await seedRun(
      analysisService,
      "analysis_run_query_latest_2",
    );

    const result = await queryService.listLatestAnalysis({
      filters: {
        channelId: "channel_fixture_complete",
      },
    });
    assert.equal(result.status, "success");
    if (result.status === "success") {
      assert.equal(
        result.value?.analysisRunId,
        "analysis_run_query_latest_2",
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("status list methods distinguish failed, completed, and partial runs", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_completed",
    );
    await seedRun(
      analysisService,
      "analysis_run_query_partial",
      partialSameChannel,
    );
    await seedRun(
      analysisService,
      "analysis_run_query_failed",
      invalidSameChannel,
    );

    const query = {
      filters: {
        channelId: "channel_fixture_complete",
      },
      pageSize: 10,
    } as const;
    const [failed, completed, partial] =
      await Promise.all([
        queryService.listFailedAnalysis(query),
        queryService.listCompletedAnalysis(query),
        queryService.listPartialAnalysis(query),
      ]);

    assert.equal(failed.status, "success");
    assert.equal(completed.status, "success");
    assert.equal(partial.status, "success");
    if (
      failed.status === "success" &&
      completed.status === "success" &&
      partial.status === "success"
    ) {
      assert.deepEqual(
        failed.value.items.map(
          (item) => item.analysisRunId,
        ),
        ["analysis_run_query_failed"],
      );
      assert.deepEqual(
        completed.value.items.map(
          (item) => item.analysisRunId,
        ),
        ["analysis_run_query_completed"],
      );
      assert.deepEqual(
        partial.value.items.map(
          (item) => item.analysisRunId,
        ),
        ["analysis_run_query_partial"],
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("getAnalysisHistory returns ordered replay lineage", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_history_root",
    );
    const replayOne =
      await analysisService.replayAnalysis({
        analysisRunId:
          "analysis_run_query_history_root",
        newAnalysisRunId:
          "analysis_run_query_history_replay_1",
        sourceData: fixtureChannelData.complete,
      });
    assert.equal(replayOne.status, "success");
    const replayTwo =
      await analysisService.replayAnalysis({
        analysisRunId:
          "analysis_run_query_history_replay_1",
        newAnalysisRunId:
          "analysis_run_query_history_replay_2",
        sourceData: fixtureChannelData.complete,
      });
    assert.equal(replayTwo.status, "success");

    const history =
      await queryService.getAnalysisHistory({
        analysisRunId:
          "analysis_run_query_history_replay_1",
      });
    assert.equal(history.status, "success");
    if (history.status === "success") {
      assert.equal(
        history.value.rootAnalysisRunId,
        "analysis_run_query_history_root",
      );
      assert.deepEqual(
        history.value.items.map((item) => ({
          id: item.analysisRunId,
          attempt: item.attempt,
        })),
        [
          {
            id: "analysis_run_query_history_root",
            attempt: 1,
          },
          {
            id: "analysis_run_query_history_replay_1",
            attempt: 2,
          },
          {
            id: "analysis_run_query_history_replay_2",
            attempt: 3,
          },
        ],
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("analysisExists returns true and false without exposing not-found as an error", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_exists",
    );

    const existing = await queryService.analysisExists(
      "analysis_run_query_exists",
    );
    const missing = await queryService.analysisExists(
      "analysis_run_query_missing",
    );
    assert.deepEqual(existing, {
      status: "success",
      value: true,
    });
    assert.deepEqual(missing, {
      status: "success",
      value: false,
    });
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("countAnalysisRuns and summarizeAnalysisRuns traverse complete channel history", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_count_complete",
    );
    await seedRun(
      analysisService,
      "analysis_run_query_count_partial",
      partialSameChannel,
    );
    await seedRun(
      analysisService,
      "analysis_run_query_count_failed",
      invalidSameChannel,
    );

    const filters = {
      channelId: "channel_fixture_complete",
    } as const;
    const count = await queryService.countAnalysisRuns({
      filters,
    });
    const summary =
      await queryService.summarizeAnalysisRuns({
        filters,
      });
    assert.deepEqual(count, {
      status: "success",
      value: 3,
    });
    assert.equal(summary.status, "success");
    if (summary.status === "success") {
      assert.deepEqual(summary.value.counts, {
        pending: 0,
        processing: 0,
        completed: 1,
        partial: 1,
        failed: 1,
      });
      assert.equal(summary.value.total, 3);
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("query operations are read-only and preserve persisted revisions", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_read_only",
    );
    const before = await harness.repository.getById(
      "analysis_run_query_read_only",
    );
    assert.equal(before.status, "success");

    await queryService.getAnalysisById(
      "analysis_run_query_read_only",
    );
    await queryService.listAnalysisRuns({
      filters: {
        channelId: "channel_fixture_complete",
      },
    });
    await queryService.analysisExists(
      "analysis_run_query_read_only",
    );
    await queryService.countAnalysisRuns({
      filters: {
        channelId: "channel_fixture_complete",
      },
    });

    const after = await harness.repository.getById(
      "analysis_run_query_read_only",
    );
    assert.deepEqual(after, before);
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("explicit mappers produce detached read models from PostgreSQL runs", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService } = createServices(
      harness.repository,
    );
    await seedRun(
      analysisService,
      "analysis_run_query_mapper",
    );
    const persisted = await harness.repository.getById(
      "analysis_run_query_mapper",
    );
    assert.equal(persisted.status, "success");
    if (persisted.status !== "success") {
      return;
    }

    const summary = mapAnalysisRunToSummary(
      persisted.value,
    );
    const history = mapAnalysisRunToHistoryItem(
      persisted.value,
    );
    const details = mapAnalysisRunToDetails(
      persisted.value,
    );
    assert.equal(summary.status, "completed");
    assert.equal(
      history.analysisRunId,
      persisted.value.analysisRunId,
    );
    assert.notEqual(
      details.analysisResult,
      persisted.value.analysisResult,
    );
    assert.equal(
      "revision" in summary,
      false,
    );
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("query validation controls page size, date ranges, and cursor filter reuse", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(harness.repository);
    await seedRun(
      analysisService,
      "analysis_run_query_validation_1",
    );
    await seedRun(
      analysisService,
      "analysis_run_query_validation_2",
    );

    const invalidPage =
      await queryService.listAnalysisRuns({
        filters: {
          channelId: "channel_fixture_complete",
        },
        pageSize: 0,
      });
    const invalidRange =
      await queryService.listAnalysisRuns({
        filters: {
          channelId: "channel_fixture_complete",
          createdFrom: "2026-07-21T00:00:00.000Z",
          createdTo: "2026-07-20T00:00:00.000Z",
        },
      });
    assert.equal(invalidPage.status, "failure");
    assert.equal(invalidRange.status, "failure");

    const first = await queryService.listAnalysisRuns({
      filters: {
        channelId: "channel_fixture_complete",
      },
      pageSize: 1,
    });
    assert.equal(first.status, "success");
    if (
      first.status === "success" &&
      first.value.cursor.nextCursor
    ) {
      const reused =
        await queryService.listAnalysisRuns({
          filters: {
            channelId: "channel_fixture_complete",
            status: "completed",
          },
          pageSize: 1,
          cursor: first.value.cursor.nextCursor,
        });
      assert.equal(reused.status, "failure");
      if (reused.status === "failure") {
        assert.equal(
          reused.error.code,
          "invalid-cursor",
        );
      }
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("getAnalysisById returns a typed not-found read failure", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { queryService } = createServices(
      harness.repository,
    );
    const result = await queryService.getAnalysisById(
      "analysis_run_query_not_found",
    );
    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "not-found");
      assert.equal(
        result.error.operation,
        "get-analysis-by-id",
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("injected Clock controls query metadata deterministically", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  try {
    const { analysisService, queryService } =
      createServices(
        harness.repository,
        new TestClock([
          "2026-07-20T19:00:00.000Z",
          "2026-07-20T19:00:01.000Z",
        ]),
      );
    await seedRun(
      analysisService,
      "analysis_run_query_clock",
    );

    const page = await queryService.listAnalysisRuns({
      filters: {
        channelId: "channel_fixture_complete",
      },
    });
    const summary =
      await queryService.summarizeAnalysisRuns({
        filters: {
          channelId: "channel_fixture_complete",
        },
      });
    assert.equal(page.status, "success");
    assert.equal(summary.status, "success");
    if (
      page.status === "success" &&
      summary.status === "success"
    ) {
      assert.equal(
        page.value.queriedAt,
        "2026-07-20T19:00:00.000Z",
      );
      assert.equal(
        summary.value.queriedAt,
        "2026-07-20T19:00:01.000Z",
      );
    }
  } finally {
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});

test("Composition Root wires repository, orchestrator, command, and query services", async () => {
  const harness = await createPostgresTestHarness(
    new TestClock(repositoryTimes()),
  );
  const composition = createAnalysisCoreComposition({
    databaseUrl: requireTestDatabaseUrl(),
    adapter: new FixtureChannelDataAdapter(
      new TestClock([adapterTime]),
    ),
    clock: new TestClock(repositoryTimes()),
    idGenerator: new FixedIdGenerator(
      "query_composition",
    ),
  });
  try {
    assert.ok(composition.repository);
    assert.ok(composition.orchestrator);
    assert.ok(composition.analysisService);
    assert.ok(composition.analysisQueryService);

    const executed =
      await composition.analysisService.runAnalysis({
        sourceData: fixtureChannelData.complete,
        creatorId: "creator_fixture_complete",
        channelId: "channel_fixture_complete",
        analysisRunId:
          "analysis_run_query_composition",
      });
    assert.equal(executed.status, "success");

    const queried =
      await composition.analysisQueryService.getAnalysisById(
        "analysis_run_query_composition",
      );
    assert.equal(queried.status, "success");
  } finally {
    await composition.disconnect();
    await deleteOwnedPostgresTestRows(harness.owned);
    await harness.owned.disconnect();
  }
});
