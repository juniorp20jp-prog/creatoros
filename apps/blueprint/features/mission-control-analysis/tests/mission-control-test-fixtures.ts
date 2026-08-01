import type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisStatusSummary,
  AnalysisSummary,
  PaginationResult,
} from "../../analysis-integration";

export const TEST_TIMESTAMP = "2026-08-01T12:00:00.000Z";

export const missionSummary: AnalysisSummary = {
  analysisRunId: "analysis_run_mission_control",
  analysisId: "analysis_mission_control",
  creatorId: "creator_fixture_complete",
  channelId: "channel_fixture_complete",
  status: "completed",
  attempt: 1,
  retryOfAnalysisRunId: null,
  warningCount: 1,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  completedAt: TEST_TIMESTAMP,
};

export const missionDetails: AnalysisDetails = {
  summary: missionSummary,
  source: {
    sourceType: "local-fixture",
    sourceSchemaVersion: "1",
    sourceReference: "fixture:complete",
  },
  pipelineVersion: "1.0.0",
  correlationId: "correlation_mission_control",
  analysisResult: {
    analysisId: "analysis_mission_control",
    analyzedAt: TEST_TIMESTAMP,
    creator: {
      id: "creator_fixture_complete",
      displayName: "Demo Creator",
      locale: "en",
    },
    channel: {
      id: "channel_fixture_complete",
      creatorId: "creator_fixture_complete",
      name: "CreatorOS Demo Channel",
      market: "US",
    },
    metrics: {
      channelId: "channel_fixture_complete",
      capturedAt: TEST_TIMESTAMP,
      subscriberCount: 12500,
      videos: [],
      analyzedVideoCount: 8,
      analyzedViews: 48000,
      averageViewsPerVideo: 6000,
      averageEngagementRate: 4.8,
      averagePublishingIntervalDays: 7,
      publishingIntervalVariation: 0.6,
      subscriberReachRate: 8,
      dataCompleteness: 0.9,
    },
    scores: [
      {
        kind: "content",
        value: 74,
        availability: "calculated",
        evidence: [],
      },
      {
        kind: "consistency",
        value: 58,
        availability: "calculated",
        evidence: [],
      },
      {
        kind: "optimization",
        value: 0,
        availability: "insufficient-data",
        evidence: [],
      },
      {
        kind: "growth",
        value: 68,
        availability: "calculated",
        evidence: [],
      },
    ],
    opportunities: [
      {
        id: "opportunity:channel_fixture_complete:publishing-cadence",
        code: "stabilize-publishing-cadence",
        impact: "medium",
        evidence: [
          { metric: "publishing-interval-variation", value: 0.6 },
        ],
      },
    ],
    recommendations: [
      {
        id: "recommendation:publishing-cadence",
        opportunityId:
          "opportunity:channel_fixture_complete:publishing-cadence",
        actionCode: "define-repeatable-publishing-cadence",
        rationaleCode: "publishing-intervals-vary",
        priority: "medium",
        evidenceMetrics: ["publishing-interval-variation"],
      },
    ],
    limitations: ["deterministic-foundation-no-external-analysis"],
  },
  failure: null,
};

export const missionHistory: AnalysisHistory = {
  rootAnalysisRunId: "analysis_run_mission_control",
  requestedAnalysisRunId: "analysis_run_mission_control_replay",
  channelId: "channel_fixture_complete",
  items: [
    {
      analysisRunId: "analysis_run_mission_control",
      analysisId: "analysis_mission_control",
      status: "completed",
      attempt: 1,
      retryOfAnalysisRunId: null,
      createdAt: TEST_TIMESTAMP,
      completedAt: TEST_TIMESTAMP,
    },
    {
      analysisRunId: "analysis_run_mission_control_replay",
      analysisId: "analysis_mission_control_replay",
      status: "partial",
      attempt: 2,
      retryOfAnalysisRunId: "analysis_run_mission_control",
      createdAt: "2026-08-01T13:00:00.000Z",
      completedAt: "2026-08-01T13:01:00.000Z",
    },
  ],
  queriedAt: TEST_TIMESTAMP,
};

export const missionStatusSummary: AnalysisStatusSummary = {
  channelId: "channel_fixture_complete",
  total: 5,
  counts: {
    completed: 1,
    partial: 1,
    failed: 1,
    processing: 1,
    pending: 1,
  },
  queriedAt: TEST_TIMESTAMP,
};

export function missionPage(
  options: {
    items?: ReadonlyArray<AnalysisSummary>;
    nextCursor?: string | null;
  } = {},
): PaginationResult<AnalysisSummary> {
  const nextCursor = options.nextCursor ?? null;
  return {
    items: options.items ?? [missionSummary],
    pageSize: 10,
    cursor: {
      nextCursor,
      hasNextPage: nextCursor !== null,
    },
    queriedAt: TEST_TIMESTAMP,
  };
}

export function successResponse<TData>(
  data: TData,
  status = 200,
): Response {
  return Response.json(
    {
      data,
      meta: {
        apiVersion: "v1",
        requestId: "request_mission_control",
        timestamp: TEST_TIMESTAMP,
      },
    },
    { status },
  );
}

export function errorResponse(status: number): Response {
  return Response.json(
    {
      error: {
        code: "INTERNAL_CODE_MUST_NOT_ESCAPE",
        message: "Private transport message.",
        details: [],
      },
      meta: {
        apiVersion: "v1",
        requestId: "request_mission_control",
        timestamp: TEST_TIMESTAMP,
      },
    },
    { status },
  );
}
