import type { YouTubeIntelligenceInput } from "../../../core";

export const noDecisionsFixture: YouTubeIntelligenceInput = {
  channel: {
    id: "demo_no_decisions_channel",
    name: "Creator Lab Stable",
    subscribers: 2500,
    languageOrMarket: "en-US",
  },
  videos: [
    {
      id: "stable_01",
      title: "Studio update one",
      publishedAt: "2026-05-01T12:00:00Z",
      durationSeconds: 480,
      views: 980,
      impressions: 20_000,
      ctr: 5,
      averagePercentageViewed: 50,
    },
    {
      id: "stable_02",
      title: "Planning update two",
      publishedAt: "2026-05-08T12:00:00Z",
      durationSeconds: 480,
      views: 1000,
      impressions: 20_000,
      ctr: 5,
      averagePercentageViewed: 50,
    },
    {
      id: "stable_03",
      title: "Research update three",
      publishedAt: "2026-05-15T12:00:00Z",
      durationSeconds: 480,
      views: 1020,
      impressions: 20_000,
      ctr: 5,
      averagePercentageViewed: 50,
    },
    {
      id: "stable_04",
      title: "Production update four",
      publishedAt: "2026-05-22T12:00:00Z",
      durationSeconds: 480,
      views: 1000,
      impressions: 20_000,
      ctr: 5,
      averagePercentageViewed: 50,
    },
  ],
  context: {
    analysisDate: "2026-07-20T12:00:00Z",
    market: "US",
    period: {
      startDate: "2026-05-01T00:00:00Z",
      endDate: "2026-05-31T23:59:59Z",
    },
  },
};

