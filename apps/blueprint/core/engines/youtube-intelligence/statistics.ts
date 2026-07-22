import { YOUTUBE_INTELLIGENCE_THRESHOLDS } from "./thresholds";
import type {
  ChannelEngagementSummary,
  PublicationFrequencySummary,
  RelativePerformanceClassification,
  SubscriberImpactSummary,
  VideoEngagement,
  ViewConcentrationSummary,
  YouTubeSignalConfidence,
  YouTubeVideoInput,
} from "./types";

const MILLISECONDS_PER_DAY = 86_400_000;

export function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }

  return sorted[middle] ?? 0;
}

export function coefficientOfVariation(
  values: ReadonlyArray<number>,
): number | undefined {
  if (values.length < 2) {
    return undefined;
  }

  const valueAverage = average(values);
  if (valueAverage === 0) {
    return undefined;
  }

  const variance = average(
    values.map((value) => (value - valueAverage) ** 2),
  );

  return Math.sqrt(variance) / valueAverage;
}

export function calculatePublicationFrequency(
  publishedAtValues: ReadonlyArray<string>,
): PublicationFrequencySummary {
  const timestamps = publishedAtValues
    .map((value) => Date.parse(value))
    .sort((left, right) => left - right);
  const intervalsDays = timestamps.slice(1).map((timestamp, index) => {
    const previous = timestamps[index];
    return previous === undefined
      ? 0
      : (timestamp - previous) / MILLISECONDS_PER_DAY;
  });
  const spanDays =
    timestamps.length > 1
      ? ((timestamps[timestamps.length - 1] ?? 0) -
          (timestamps[0] ?? 0)) /
        MILLISECONDS_PER_DAY
      : 0;

  return {
    intervalCount: intervalsDays.length,
    intervalsDays,
    averageIntervalDays:
      intervalsDays.length > 0 ? average(intervalsDays) : undefined,
    medianIntervalDays:
      intervalsDays.length > 0 ? median(intervalsDays) : undefined,
    coefficientOfVariation: coefficientOfVariation(intervalsDays),
    videosPer30Days:
      spanDays > 0 ? ((timestamps.length - 1) * 30) / spanDays : undefined,
  };
}

export function classifyRelativePerformance(
  views: number,
  channelMedianViews: number,
  sampleSize: number,
): RelativePerformanceClassification {
  if (sampleSize <= 1) {
    return "near-median";
  }

  if (channelMedianViews === 0) {
    return views === 0 ? "near-median" : "above-median";
  }

  const ratio = views / channelMedianViews;
  const { classification } = YOUTUBE_INTELLIGENCE_THRESHOLDS;

  if (ratio < classification.belowMedianUpperRatio) {
    return "below-median";
  }
  if (ratio < classification.aboveMedianLowerRatio) {
    return "near-median";
  }
  if (ratio < classification.exceptionalLowerRatio) {
    return "above-median";
  }

  return "exceptional";
}

export function calculateVideoEngagement(
  video: YouTubeVideoInput,
): VideoEngagement | undefined {
  if (video.views <= 0) {
    return undefined;
  }

  const includedMetrics: Array<"likes" | "comments"> = [];
  let interactions = 0;

  if (video.likes !== undefined) {
    includedMetrics.push("likes");
    interactions += video.likes;
  }
  if (video.comments !== undefined) {
    includedMetrics.push("comments");
    interactions += video.comments;
  }
  if (includedMetrics.length === 0) {
    return undefined;
  }

  return {
    rate: interactions / video.views,
    interactions,
    includedMetrics,
    partial: includedMetrics.length === 1,
  };
}

export function calculateChannelEngagement(
  videos: ReadonlyArray<YouTubeVideoInput>,
): ChannelEngagementSummary {
  let interactions = 0;
  let eligibleViews = 0;
  let eligibleVideoCount = 0;
  let partiallyMeasuredVideoCount = 0;

  for (const video of videos) {
    const engagement = calculateVideoEngagement(video);
    if (!engagement) {
      continue;
    }

    interactions += engagement.interactions;
    eligibleViews += video.views;
    eligibleVideoCount += 1;
    partiallyMeasuredVideoCount += engagement.partial ? 1 : 0;
  }

  return {
    rate: eligibleViews > 0 ? interactions / eligibleViews : undefined,
    interactions,
    eligibleViews,
    eligibleVideoCount,
    partiallyMeasuredVideoCount,
  };
}

export function calculateSubscriberImpact(
  videos: ReadonlyArray<YouTubeVideoInput>,
): SubscriberImpactSummary {
  const eligible = videos.filter(
    (video) => video.subscribersGained !== undefined,
  );
  const totalSubscribersGained =
    eligible.length > 0
      ? eligible.reduce(
          (total, video) => total + (video.subscribersGained ?? 0),
          0,
        )
      : undefined;
  const eligibleViews = eligible.reduce(
    (total, video) => total + video.views,
    0,
  );

  return {
    totalSubscribersGained,
    averageSubscribersGainedPerEligibleVideo:
      totalSubscribersGained === undefined
        ? undefined
        : totalSubscribersGained / eligible.length,
    subscribersGainedPerThousandViews:
      totalSubscribersGained !== undefined && eligibleViews > 0
        ? (totalSubscribersGained / eligibleViews) * 1000
        : undefined,
    eligibleVideoCount: eligible.length,
  };
}

export function calculateViewConcentration(
  views: ReadonlyArray<number>,
): ViewConcentrationSummary {
  const totalViews = views.reduce((total, value) => total + value, 0);
  const sorted = [...views].sort((left, right) => right - left);
  const topThree = sorted.slice(0, 3);

  return {
    topVideoShare:
      totalViews > 0 && sorted.length > 0
        ? (sorted[0] ?? 0) / totalViews
        : undefined,
    topThreeShare:
      totalViews > 0 && topThree.length > 0
        ? topThree.reduce((total, value) => total + value, 0) / totalViews
        : undefined,
    videosIncludedInTopThree: topThree.length,
    limitedSample: views.length < 3,
  };
}

export function calculateSignalConfidence(
  sampleSize: number,
  availability: number,
  consistency: number,
): YouTubeSignalConfidence {
  const { confidence } = YOUTUBE_INTELLIGENCE_THRESHOLDS;

  if (
    sampleSize >= confidence.high.minimumSampleSize &&
    availability >= confidence.high.minimumAvailability &&
    consistency >= confidence.high.minimumConsistency
  ) {
    return "high";
  }

  if (
    sampleSize >= confidence.medium.minimumSampleSize &&
    availability >= confidence.medium.minimumAvailability &&
    consistency >= confidence.medium.minimumConsistency
  ) {
    return "medium";
  }

  return "low";
}
