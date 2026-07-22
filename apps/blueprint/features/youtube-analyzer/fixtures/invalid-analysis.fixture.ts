import type { YouTubeIntelligenceInput } from "../../../core";

export const invalidAnalysisFixture: YouTubeIntelligenceInput = {
  channel: {
    id: "demo_invalid_channel",
    name: "Creator Lab Invalid",
    subscribers: 1200,
  },
  videos: [
    {
      id: "invalid_duplicate",
      title: "Invalid input one",
      publishedAt: "2026-04-01T10:00:00Z",
      durationSeconds: 300,
      views: 800,
      ctr: 120,
    },
    {
      id: "invalid_duplicate",
      title: "Invalid input two",
      publishedAt: "2026-04-08T10:00:00Z",
      durationSeconds: 360,
      views: 900,
    },
  ],
  context: {
    analysisDate: "2026-07-20T12:00:00Z",
    period: {
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-06-30T23:59:59Z",
    },
  },
};
