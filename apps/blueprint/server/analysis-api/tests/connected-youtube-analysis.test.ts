import assert from "node:assert/strict";
import test from "node:test";

import type {
  AnalysisApplicationService,
  AuthenticatedAnalysisPrincipal,
  InternalAnalysisApiDependencies,
} from "../contracts";
import type {
  PersistedYouTubeChannelData,
  RunAnalysisInput,
} from "../../../core";
import { InternalAnalysisApi } from "../internal-analysis-api";
import {
  createDetails,
  createTestDependencies,
  jsonRequest,
  responseJson,
} from "./api-test-fixtures";

const principalA: AuthenticatedAnalysisPrincipal = {
  userId: "user_a",
  displayName: "Creator A",
  locale: "es",
};

function connectedSource(): PersistedYouTubeChannelData {
  const timestamp = "2026-09-07T12:00:00.000Z";
  return {
    creator: principalA,
    collectedAt: timestamp,
    synchronizationReference: "video-sync:sync_a",
    channel: {
      userId: "user_a",
      youtubeIdentityId: "identity_a",
      channelId: "channel_a",
      title: "Channel A",
      description: "",
      publishedAt: "2020-01-01T00:00:00.000Z",
      subscriberCount: "100",
      viewCount: "1000",
      videoCount: "1",
      hiddenSubscriberCount: false,
      keywords: [],
      brandingSettings: { keywords: [] },
      privacyStatus: "public",
      lastSyncedAt: timestamp,
      syncStatus: "synced",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    videos: [{
      userId: "user_a",
      channelId: "channel_a",
      videoId: "video_a",
      title: "Video A",
      description: "",
      publishedAt: "2026-01-01T00:00:00.000Z",
      durationSeconds: 60,
      viewCount: "10",
      availabilityStatus: "available",
      lastSeenAt: timestamp,
      lastSyncedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
  };
}

function withConnected(
  base: InternalAnalysisApiDependencies,
  service?: AnalysisApplicationService<PersistedYouTubeChannelData>,
): InternalAnalysisApiDependencies {
  const delegated: AnalysisApplicationService<PersistedYouTubeChannelData> =
    service ?? {
      runAnalysis: (input) => base.analysisService.runAnalysis(input),
      replayAnalysis: (input) => base.analysisService.replayAnalysis(input),
      deleteAnalysis: (id, options) => base.analysisService.deleteAnalysis(id, options),
    };
  return {
    ...base,
    connectedYouTube: {
      analysisService: delegated,
      sourceResolver: {
        async resolve() {
          return { status: "success", value: connectedSource() };
        },
      },
    },
  };
}

test("connected-youtube run derives creator and channel ownership from the principal", async () => {
  const base = createTestDependencies();
  let received: RunAnalysisInput<PersistedYouTubeChannelData> | undefined;
  const service: AnalysisApplicationService<PersistedYouTubeChannelData> = {
    runAnalysis: async (input) => {
      received = input;
      return base.analysisService.runAnalysis(input);
    },
    replayAnalysis: (input) => base.analysisService.replayAnalysis(input),
    deleteAnalysis: (id, options) => base.analysisService.deleteAnalysis(id, options),
  };
  const api = new InternalAnalysisApi(withConnected(base, service));
  const response = await api.runAnalysis(
    jsonRequest("/api/internal/v1/analysis-runs", "POST", {
      source: "connected-youtube",
    }),
    principalA,
  );

  assert.equal(response.status, 201);
  assert.equal(received?.creatorId, "user_a");
  assert.equal(received?.channelId, "channel_a");
  assert.equal(received?.sourceReference, "video-sync:sync_a");
});

test("real AnalysisRun details, history, and delete conceal cross-tenant resources", async () => {
  let historyCalled = false;
  let deleteCalled = false;
  const base = createTestDependencies({
    analysisService: {
      async deleteAnalysis() {
        deleteCalled = true;
        throw new Error("must not execute");
      },
    },
    analysisQueryService: {
      async getAnalysisById(analysisRunId) {
        return {
          status: "success",
          value: createDetails({
            summary: {
              ...createDetails().summary,
              analysisRunId,
              creatorId: "user_b",
              channelId: "channel_b",
            },
            source: {
              sourceType: "connected-youtube",
              sourceSchemaVersion: "1.0",
              sourceReference: "video-sync:redacted",
            },
          }),
        };
      },
      async getAnalysisHistory() {
        historyCalled = true;
        throw new Error("must not execute");
      },
    },
  });
  const api = new InternalAnalysisApi(base);

  const get = await api.getAnalysis("analysis_run_b", principalA);
  const history = await api.getAnalysisHistory("analysis_run_b", principalA);
  const deletion = await api.deleteAnalysis(
    new Request("http://localhost/api/internal/v1/analysis-runs/analysis_run_b", { method: "DELETE" }),
    "analysis_run_b",
    principalA,
  );

  assert.deepEqual([get.status, history.status, deletion.status], [404, 404, 404]);
  assert.equal(historyCalled, false);
  assert.equal(deleteCalled, false);
  assert.match(JSON.stringify(await responseJson(get)), /ANALYSIS_NOT_FOUND/);
});

test("connected-youtube list replaces client ownership identifiers with authenticated scope", async () => {
  let capturedCreator = "";
  let capturedChannel = "";
  const base = createTestDependencies({
    analysisQueryService: {
      async listAnalysisRuns(query) {
        capturedCreator = query.filters.creatorId ?? "";
        capturedChannel = query.filters.channelId;
        return { status: "success", value: { items: [], pageSize: 10, cursor: { nextCursor: null, hasNextPage: false }, queriedAt: "2026-09-07T12:00:00.000Z" } };
      },
    },
  });
  const api = new InternalAnalysisApi(withConnected(base));
  const response = await api.listAnalysisRuns(
    new Request("http://localhost/api/internal/v1/analysis-runs?source=connected-youtube&creatorId=user_b&channelId=channel_b&limit=10"),
    principalA,
  );

  assert.equal(response.status, 200);
  assert.equal(capturedCreator, "user_a");
  assert.equal(capturedChannel, "channel_a");
});