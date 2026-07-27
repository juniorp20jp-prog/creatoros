import type { ChannelMetricsCalculator } from "./contracts";
import type {
  ChannelMetrics,
  NormalizedChannelData,
  VideoMetrics,
} from "./domain-models";

const MILLISECONDS_PER_DAY = 86_400_000;
const VIDEO_OPTIONAL_FIELD_COUNT = 3;
const CHANNEL_OPTIONAL_FIELD_COUNT = 2;

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) /
    values.length;
}

function publishingIntervals(
  videos: ReadonlyArray<VideoMetrics>,
): ReadonlyArray<number> {
  const timestamps = videos
    .map((video) => Date.parse(video.publishedAt))
    .sort((left, right) => left - right);

  return timestamps.slice(1).map(
    (timestamp, index) =>
      (timestamp - (timestamps[index] ?? timestamp)) /
      MILLISECONDS_PER_DAY,
  );
}

function coefficientOfVariation(
  values: ReadonlyArray<number>,
): number | undefined {
  if (values.length < 2) {
    return undefined;
  }

  const mean = average(values);

  if (mean === 0) {
    return 0;
  }

  const variance = average(
    values.map((value) => (value - mean) ** 2),
  );

  return Math.sqrt(variance) / mean;
}

function engagementRate(
  videos: ReadonlyArray<VideoMetrics>,
): number | undefined {
  const eligible = videos.filter(
    (video) =>
      video.views > 0 &&
      (video.likes !== undefined || video.comments !== undefined),
  );

  if (eligible.length === 0) {
    return undefined;
  }

  const views = eligible.reduce(
    (total, video) => total + video.views,
    0,
  );
  const interactions = eligible.reduce(
    (total, video) =>
      total + (video.likes ?? 0) + (video.comments ?? 0),
    0,
  );

  return views === 0 ? undefined : (interactions / views) * 100;
}

function completeness(input: NormalizedChannelData): number {
  const expected =
    CHANNEL_OPTIONAL_FIELD_COUNT +
    input.videos.length * VIDEO_OPTIONAL_FIELD_COUNT;
  const channelAvailable =
    Number(input.reportedTotalViews !== undefined) +
    Number(input.reportedVideoCount !== undefined);
  const videoAvailable = input.videos.reduce(
    (total, video) =>
      total +
      Number(video.likes !== undefined) +
      Number(video.comments !== undefined) +
      Number(video.durationSeconds !== undefined),
    0,
  );

  return expected === 0
    ? channelAvailable / CHANNEL_OPTIONAL_FIELD_COUNT
    : (channelAvailable + videoAvailable) / expected;
}

export class DefaultChannelMetricsCalculator
  implements ChannelMetricsCalculator
{
  calculate(input: NormalizedChannelData): ChannelMetrics {
    const analyzedViews = input.videos.reduce(
      (total, video) => total + video.views,
      0,
    );
    const intervals = publishingIntervals(input.videos);
    const averageViewsPerVideo =
      input.videos.length === 0
        ? 0
        : analyzedViews / input.videos.length;

    return {
      channelId: input.channel.id,
      capturedAt: input.collectedAt,
      subscriberCount: input.subscriberCount,
      reportedTotalViews: input.reportedTotalViews,
      reportedVideoCount: input.reportedVideoCount,
      videos: input.videos,
      analyzedVideoCount: input.videos.length,
      analyzedViews,
      averageViewsPerVideo,
      averageEngagementRate: engagementRate(input.videos),
      averagePublishingIntervalDays:
        intervals.length === 0 ? undefined : average(intervals),
      publishingIntervalVariation:
        coefficientOfVariation(intervals),
      subscriberReachRate:
        input.subscriberCount === 0
          ? undefined
          : (averageViewsPerVideo / input.subscriberCount) * 100,
      dataCompleteness: completeness(input),
    };
  }
}
