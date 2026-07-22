import type { YouTubeIntelligenceInput } from "../../../core";

export const insufficientSampleFixture: YouTubeIntelligenceInput = {
  channel: {
    id: "demo_small_channel",
    name: "Creator Lab Starter",
    subscribers: 340,
  },
  videos: [
    {
      id: "small_01",
      title: "First creator experiment",
      publishedAt: "2026-05-04T18:00:00Z",
      durationSeconds: 240,
      views: 120,
      likes: 9,
      comments: 2,
      ctr: 5.4,
    },
    {
      id: "small_02",
      title: "Second creator experiment",
      publishedAt: "2026-05-18T18:00:00Z",
      durationSeconds: 320,
      views: 210,
      likes: 18,
      comments: 3,
      ctr: 6.1,
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
