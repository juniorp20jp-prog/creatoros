import { YOUTUBE_INTELLIGENCE_THRESHOLDS } from "./thresholds";
import type {
  DataQualityWarning,
  ExcludedVideo,
  UnevaluatedSignal,
  YouTubeChannelInput,
  YouTubeDataQuality,
  YouTubeVideoInput,
} from "./types";

const VIDEO_OPTIONAL_FIELDS = [
  "likes",
  "comments",
  "impressions",
  "ctr",
  "averageViewDurationSeconds",
  "averagePercentageViewed",
  "subscribersGained",
] as const;

const CHANNEL_OPTIONAL_FIELDS = [
  "createdAt",
  "totalViews",
  "totalVideos",
  "languageOrMarket",
] as const;

export function createDataQualityReport(options: {
  channel: YouTubeChannelInput;
  inputVideoCount: number;
  analyzedVideos: ReadonlyArray<YouTubeVideoInput>;
  excludedVideos: ReadonlyArray<ExcludedVideo>;
  validationWarnings: ReadonlyArray<DataQualityWarning>;
  unevaluatedSignals: ReadonlyArray<UnevaluatedSignal>;
}): YouTubeDataQuality {
  const completelyAvailable = [
    "channel.id",
    "channel.name",
    "channel.subscribers",
    "context.analysisDate",
    "context.period",
  ];
  const partiallyAvailable: Array<string> = [];
  const absent: Array<string> = [];

  for (const field of CHANNEL_OPTIONAL_FIELDS) {
    const path = `channel.${field}`;
    if (options.channel[field] === undefined) {
      absent.push(path);
    } else {
      completelyAvailable.push(path);
    }
  }

  const requiredVideoFields = [
    "videos.id",
    "videos.title",
    "videos.publishedAt",
    "videos.durationSeconds",
    "videos.views",
  ];
  if (options.analyzedVideos.length === 0) {
    absent.push(...requiredVideoFields);
  } else {
    completelyAvailable.push(...requiredVideoFields);
  }

  for (const field of VIDEO_OPTIONAL_FIELDS) {
    const path = `videos.${field}`;
    const availableCount = options.analyzedVideos.filter(
      (video) => video[field] !== undefined,
    ).length;

    if (availableCount === 0) {
      absent.push(path);
    } else if (availableCount === options.analyzedVideos.length) {
      completelyAvailable.push(path);
    } else {
      partiallyAvailable.push(path);
    }
  }

  const warnings = [...options.validationWarnings];
  const partialEngagementIds = options.analyzedVideos
    .filter(
      (video) =>
        (video.likes === undefined) !== (video.comments === undefined),
    )
    .map((video) => video.id);
  if (partialEngagementIds.length > 0) {
    warnings.push({
      code: "partial-engagement-components",
      message:
        "Engagement was calculated from the available interaction component only for the listed videos.",
      videoIds: partialEngagementIds,
    });
  }

  const limitations = [
    "historical-channel-growth-unavailable-without-subscriber-history",
    "no-external-benchmarks-or-causal-inferences",
    "title-term-analysis-is-lexical-and-not-topic-detection",
  ];
  if (
    options.analyzedVideos.length <
    YOUTUBE_INTELLIGENCE_THRESHOLDS.confidence.high.minimumSampleSize
  ) {
    limitations.push("small-sample-reduces-signal-confidence");
  }

  return {
    fields: {
      completelyAvailable,
      partiallyAvailable,
      absent,
    },
    inputVideoCount: options.inputVideoCount,
    effectiveVideoCount: options.analyzedVideos.length,
    excludedVideos: options.excludedVideos,
    warnings,
    limitations,
    unevaluatedSignals: options.unevaluatedSignals,
  };
}
