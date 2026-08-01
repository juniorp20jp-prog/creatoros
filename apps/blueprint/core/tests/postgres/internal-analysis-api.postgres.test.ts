import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FixtureChannelDataAdapter,
} from "../../adapters";
import {
  createAnalysisCoreComposition,
  type AnalysisCoreComposition,
} from "../../composition";
import {
  createAnalysisRunPrismaClient,
  PrismaSessionRepository,
  PrismaUserRepository,
} from "../../persistence/prisma";
import {
  UuidGenerator,
} from "../../services";
import { TestClock } from "../fixtures/analysis-run-v2-fixtures";
import {
  deleteOwnedPostgresTestRows,
  requireTestDatabaseUrl,
} from "./postgres-test-harness";
import { InternalAnalysisApi } from "../../../server/analysis-api/internal-analysis-api";
import { InternalAnalysisFixtureCatalog } from "../../../server/analysis-api/fixture-catalog";
import { SessionTokenService } from "../../../server/auth";

const timestamps = Array.from({ length: 200 }, (_, index) =>
  new Date(
    Date.parse("2026-08-01T12:00:00.000Z") + index * 1_000,
  ).toISOString(),
);

type ApiContext = {
  api: InternalAnalysisApi;
  composition: AnalysisCoreComposition<unknown>;
  close(): Promise<void>;
};

async function createApiContext(): Promise<ApiContext> {
  const databaseUrl = requireTestDatabaseUrl();
  const cleaner = createAnalysisRunPrismaClient(databaseUrl);
  await deleteOwnedPostgresTestRows(cleaner);
  await cleaner.disconnect();

  const clock = new TestClock(timestamps);
  const composition = createAnalysisCoreComposition({
    databaseUrl,
    adapter: new FixtureChannelDataAdapter(clock),
    clock,
    idGenerator: new UuidGenerator(),
  });
  return {
    api: new InternalAnalysisApi({
      analysisService: composition.analysisService,
      analysisQueryService: composition.analysisQueryService,
      fixtureCatalog: new InternalAnalysisFixtureCatalog(),
      clock,
      requestIdGenerator: new UuidGenerator(),
    }),
    composition,
    async close() {
      await composition.disconnect();
      const cleanup = createAnalysisRunPrismaClient(databaseUrl);
      await deleteOwnedPostgresTestRows(cleanup);
      await cleanup.disconnect();
    },
  };
}

function runRequest(
  analysisRunId: string,
  fixtureId = "complete",
): Request {
  const fixture = new InternalAnalysisFixtureCatalog().get(fixtureId);
  return new Request(
    "http://localhost/api/internal/v1/analysis-runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fixtureId,
        creatorId: fixture?.creatorId ?? "creator_fixture_complete",
        channelId: fixture?.channelId ?? "channel_fixture_complete",
        correlationId: `correlation_${analysisRunId}`,
        analysisRunId,
      }),
    },
  );
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

test("HTTP transport runs and reads an analysis through PostgreSQL", async () => {
  const context = await createApiContext();
  try {
    const created = await context.api.runAnalysis(
      runRequest("analysis_run_api_pg_get"),
    );
    const details = await context.api.getAnalysis(
      "analysis_run_api_pg_get",
    );

    assert.equal(created.status, 201);
    assert.equal(details.status, 200);
    const serialized = JSON.stringify(await body(details));
    assert.match(serialized, /analysis_run_api_pg_get/);
    assert.doesNotMatch(serialized, /rawChannelData|Prisma|revision/);
  } finally {
    await context.close();
  }
});

test("HTTP list uses deterministic PostgreSQL cursor pagination", async () => {
  const context = await createApiContext();
  try {
    for (const id of [
      "analysis_run_api_pg_page_1",
      "analysis_run_api_pg_page_2",
      "analysis_run_api_pg_page_3",
    ]) {
      assert.equal((await context.api.runAnalysis(runRequest(id))).status, 201);
    }
    const first = await context.api.listAnalysisRuns(
      new Request(
        "http://localhost/api/internal/v1/analysis-runs?channelId=channel_fixture_complete&limit=2",
      ),
    );
    const firstBody = await body(first);
    const firstData = firstBody.data as {
      items: ReadonlyArray<{ analysisRunId: string }>;
      cursor: { nextCursor: string | null };
    };
    assert.equal(first.status, 200);
    assert.equal(firstData.items.length, 2);
    assert.ok(firstData.cursor.nextCursor);

    const second = await context.api.listAnalysisRuns(
      new Request(
        `http://localhost/api/internal/v1/analysis-runs?channelId=channel_fixture_complete&limit=2&cursor=${firstData.cursor.nextCursor}`,
      ),
    );
    const secondData = (await body(second)).data as {
      items: ReadonlyArray<{ analysisRunId: string }>;
    };
    assert.equal(second.status, 200);
    assert.equal(secondData.items.length, 1);
    assert.equal(
      new Set([
        ...firstData.items.map((item) => item.analysisRunId),
        ...secondData.items.map((item) => item.analysisRunId),
      ]).size,
      3,
    );
  } finally {
    await context.close();
  }
});

test("HTTP list applies creator, status, date, attempt, and analysis filters", async () => {
  const context = await createApiContext();
  try {
    assert.equal(
      (await context.api.runAnalysis(runRequest("analysis_run_api_pg_filters")))
        .status,
      201,
    );
    const details = await context.composition.analysisQueryService
      .getAnalysisById("analysis_run_api_pg_filters");
    assert.equal(details.status, "success");
    if (details.status !== "success") {
      return;
    }
    const analysisId = details.value.summary.analysisId;
    assert.ok(analysisId);
    const response = await context.api.listAnalysisRuns(
      new Request(
        `http://localhost/api/internal/v1/analysis-runs?channelId=channel_fixture_complete&creatorId=creator_fixture_complete&status=completed&from=2026-08-01T12%3A00%3A00.000Z&to=2026-08-01T12%3A10%3A00.000Z&attempt=1&analysisId=${analysisId}`,
      ),
    );
    const data = (await body(response)).data as {
      items: ReadonlyArray<unknown>;
    };
    assert.equal(response.status, 200);
    assert.equal(data.items.length, 1);
  } finally {
    await context.close();
  }
});

test("HTTP replay preserves the original and exposes PostgreSQL history", async () => {
  const context = await createApiContext();
  try {
    assert.equal(
      (await context.api.runAnalysis(runRequest("analysis_run_api_pg_root")))
        .status,
      201,
    );
    const replay = await context.api.replayAnalysis(
      new Request(
        "http://localhost/api/internal/v1/analysis-runs/analysis_run_api_pg_root/replay",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fixtureId: "complete",
            newAnalysisRunId: "analysis_run_api_pg_replay",
          }),
        },
      ),
      "analysis_run_api_pg_root",
    );
    const history = await context.api.getAnalysisHistory(
      "analysis_run_api_pg_replay",
    );
    const data = (await body(history)).data as {
      items: ReadonlyArray<{
        analysisRunId: string;
        attempt: number;
        retryOfAnalysisRunId: string | null;
      }>;
    };

    assert.equal(replay.status, 201);
    assert.equal(history.status, 200);
    assert.equal(data.items.length, 2);
    assert.deepEqual(
      data.items.map((item) => ({
        id: item.analysisRunId,
        attempt: item.attempt,
        retryOf: item.retryOfAnalysisRunId,
      })),
      [
        { id: "analysis_run_api_pg_root", attempt: 1, retryOf: null },
        {
          id: "analysis_run_api_pg_replay",
          attempt: 2,
          retryOf: "analysis_run_api_pg_root",
        },
      ],
    );
    assert.equal(
      (
        await context.composition.repository.getById(
          "analysis_run_api_pg_root",
        )
      ).status,
      "success",
    );
  } finally {
    await context.close();
  }
});

test("HTTP delete enforces optimistic concurrency against PostgreSQL", async () => {
  const context = await createApiContext();
  try {
    assert.equal(
      (await context.api.runAnalysis(runRequest("analysis_run_api_pg_delete")))
        .status,
      201,
    );
    const stored = await context.composition.repository.getById(
      "analysis_run_api_pg_delete",
    );
    assert.equal(stored.status, "success");
    if (stored.status !== "success") {
      return;
    }
    const stale = await context.api.deleteAnalysis(
      new Request(
        `http://localhost/delete?expectedRevision=${stored.value.revision - 1}`,
        { method: "DELETE" },
      ),
      stored.value.analysisRunId,
    );
    const deleted = await context.api.deleteAnalysis(
      new Request(
        `http://localhost/delete?expectedRevision=${stored.value.revision}`,
        { method: "DELETE" },
      ),
      stored.value.analysisRunId,
    );
    assert.equal(stale.status, 409);
    assert.equal(deleted.status, 200);
    assert.equal(
      (
        await context.composition.repository.getById(
          stored.value.analysisRunId,
        )
      ).status,
      "failure",
    );
  } finally {
    await context.close();
  }
});

test("HTTP status summary derives partial from stored adapter warnings", async () => {
  const context = await createApiContext();
  try {
    assert.equal(
      (await context.api.runAnalysis(runRequest("analysis_run_api_pg_complete")))
        .status,
      201,
    );
    assert.equal(
      (
        await context.api.runAnalysis(
          runRequest("analysis_run_api_pg_partial", "unknownFields"),
        )
      ).status,
      201,
    );
    const response = await context.api.summarizeAnalysisRuns(
      new Request(
        "http://localhost/status-summary?channelId=channel_fixture_complete",
      ),
    );
    const data = (await body(response)).data as {
      total: number;
      counts: { completed: number; partial: number };
    };
    assert.equal(response.status, 200);
    assert.equal(data.total, 2);
    assert.equal(data.counts.completed, 1);
    assert.equal(data.counts.partial, 1);
  } finally {
    await context.close();
  }
});

test("HTTP adapter failure is persisted and mapped without internal details", async () => {
  const context = await createApiContext();
  try {
    const response = await context.api.runAnalysis(
      runRequest("analysis_run_api_pg_adapter_failure", "invalidMetrics"),
    );
    const responseBody = await body(response);
    const stored = await context.composition.repository.getById(
      "analysis_run_api_pg_adapter_failure",
    );
    assert.equal(response.status, 422);
    assert.match(JSON.stringify(responseBody), /ANALYSIS_ADAPTER_FAILED/);
    assert.doesNotMatch(
      JSON.stringify(responseBody),
      /Prisma|postgresql:\/\/|\bSELECT\b|stack trace/i,
    );
    assert.equal(stored.status, "success");
    if (stored.status === "success") {
      assert.equal(stored.value.status, "failed");
    }
  } finally {
    await context.close();
  }
});

test("HTTP duplicate identifiers map to 409 and preserve the original run", async () => {
  const context = await createApiContext();
  try {
    const first = await context.api.runAnalysis(
      runRequest("analysis_run_api_pg_duplicate"),
    );
    const duplicate = await context.api.runAnalysis(
      runRequest("analysis_run_api_pg_duplicate"),
    );
    const stored = await context.composition.repository.getById(
      "analysis_run_api_pg_duplicate",
    );
    assert.equal(first.status, 201);
    assert.equal(duplicate.status, 409);
    assert.match(
      JSON.stringify(await body(duplicate)),
      /DUPLICATE_ANALYSIS_RUN_ID/,
    );
    assert.equal(stored.status, "success");
  } finally {
    await context.close();
  }
});

test("invalid HTTP requests do not write PostgreSQL rows", async () => {
  const context = await createApiContext();
  try {
    const invalid = await context.api.runAnalysis(
      new Request("http://localhost/analysis-runs", {
        method: "POST",
        body: "{invalid-json",
      }),
    );
    const missing = await context.api.getAnalysis(
      "analysis_run_api_pg_never_written",
    );
    assert.equal(invalid.status, 400);
    assert.equal(missing.status, 404);
  } finally {
    await context.close();
  }
});

test("actual Next.js Route Handlers resolve the server-only Composition Root", async () => {
  const databaseUrl = requireTestDatabaseUrl();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousAuthCookieSecret = process.env.AUTH_COOKIE_SECRET;
  const testAuthCookieSecret = "postgres-route-test-secret-32-characters";
  const cleaner = createAnalysisRunPrismaClient(databaseUrl);
  await deleteOwnedPostgresTestRows(cleaner);
  process.env.DATABASE_URL = databaseUrl;
  process.env.AUTH_COOKIE_SECRET = testAuthCookieSecret;
  const tokens = new SessionTokenService(testAuthCookieSecret);
  const token = await tokens.generate();
  const now = new Date();
  const routeUser = new PrismaUserRepository(cleaner.client);
  const routeSessions = new PrismaSessionRepository(cleaner.client);
  await routeUser.create({ userId: "auth_test_route_user", email: "route@example.com", displayName: "Route User", locale: "es", createdAt: now.toISOString() });
  await routeSessions.create({ sessionId: "auth_test_route_session", userId: "auth_test_route_user", tokenHash: token.tokenHash, createdAt: now.toISOString(), expiresAt: new Date(now.valueOf() + 3_600_000).toISOString(), metadata: { clientType: "internal" } });
  await cleaner.disconnect();

  const route = await import(
    "../../../app/api/internal/v1/analysis-runs/route"
  );
  const detailsRoute = await import(
    "../../../app/api/internal/v1/analysis-runs/[analysisRunId]/route"
  );
  const runtime = await import(
    "../../../server/analysis-api/runtime"
  );
  try {
    const anonymous = await route.POST(runRequest("analysis_run_api_pg_anonymous"));
    const created = await route.POST(withSession(runRequest("analysis_run_api_pg_next_route"), token.token));
    const details = await detailsRoute.GET(
      withSession(new Request("http://localhost/details"), token.token),
      {
        params: Promise.resolve({
          analysisRunId: "analysis_run_api_pg_next_route",
        }),
      },
    );
    assert.equal(anonymous.status, 401);
    assert.equal(created.status, 201);
    assert.equal(details.status, 200);
    assert.match(
      JSON.stringify(await body(details)),
      /analysis_run_api_pg_next_route/,
    );
  } finally {
    await runtime.disconnectInternalAnalysisApiRuntime();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    if (previousAuthCookieSecret === undefined) {
      delete process.env.AUTH_COOKIE_SECRET;
    } else {
      process.env.AUTH_COOKIE_SECRET = previousAuthCookieSecret;
    }
    const cleanup = createAnalysisRunPrismaClient(databaseUrl);
    await deleteOwnedPostgresTestRows(cleanup);
    await cleanup.disconnect();
  }
});

function withSession(request: Request, token: string): Request {
  const headers = new Headers(request.headers);
  headers.set("cookie", `creatoros_session=${token}`);
  return new Request(request, { headers });
}

test("Composition Root and HTTP transport close without leaking clients", async () => {
  const context = await createApiContext();
  const response = await context.api.runAnalysis(
    runRequest("analysis_run_api_pg_disconnect"),
  );
  assert.equal(response.status, 201);
  await context.close();

  const probe = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  try {
    await probe.client.analysisRunRow.count();
  } finally {
    await probe.disconnect();
  }
});
