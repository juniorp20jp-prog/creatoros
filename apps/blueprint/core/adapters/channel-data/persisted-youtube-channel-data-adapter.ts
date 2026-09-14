import type { YouTubeChannel } from "../../youtube-channel-sync";
import type { YouTubeVideo } from "../../youtube-video-sync";
import type { VideoAnalyticsProjection } from "../../youtube-analytics";
import type { RawVideoMetrics } from "../../engines/creator-intelligence";
import { SystemClock, type Clock } from "../../services";
import type {
  ChannelDataAdapter,
  ChannelDataAdapterDefinition,
  ChannelDataAdapterError,
  ChannelDataAdapterMetadata,
  ChannelDataAdapterResult,
  ChannelDataAdapterWarning,
} from "./contracts";

export const PERSISTED_YOUTUBE_SOURCE_SCHEMA_VERSION = "1.0" as const;

export type PersistedYouTubeChannelData = Readonly<{
  creator: Readonly<{ userId: string; displayName: string; locale: string }>;
  channel: YouTubeChannel;
  videos: ReadonlyArray<YouTubeVideo>;
  collectedAt: string;
  synchronizationReference?: string;
  analytics?: ReadonlyArray<VideoAnalyticsProjection>;
}>;

const definition = {
  adapterId: "persisted-youtube-channel-data",
  adapterVersion: "1.0.0",
  sourceType: "connected-youtube",
  supportedSchemaVersion: PERSISTED_YOUTUBE_SOURCE_SCHEMA_VERSION,
} satisfies ChannelDataAdapterDefinition;

export class PersistedYouTubeChannelDataAdapter
  implements ChannelDataAdapter<PersistedYouTubeChannelData>
{
  readonly definition = definition;

  constructor(private readonly clock: Clock = new SystemClock()) {}

  adapt(source: PersistedYouTubeChannelData): ChannelDataAdapterResult {
    const metadata: ChannelDataAdapterMetadata = {
      ...this.definition,
      processedAt: this.clock.now(),
    };
    const errors: ChannelDataAdapterError[] = [];
    const warnings: ChannelDataAdapterWarning[] = [];

    if (source.creator.userId.trim() !== source.channel.userId.trim()) {
      errors.push({
        severity: "error",
        code: "IDENTITY_MISMATCH",
        path: "$.channel.userId",
        message: "Persisted channel owner does not match the authenticated creator.",
      });
    }

    const subscribers = requiredCounter(
      source.channel.subscriberCount,
      "$.channel.subscriberCount",
      errors,
    );
    const totalViews = optionalCounter(
      source.channel.viewCount,
      "$.channel.viewCount",
      warnings,
    );
    const totalVideos = optionalCounter(
      source.channel.videoCount,
      "$.channel.videoCount",
      warnings,
    );
    const videos = source.videos
      .slice()
      .sort(
        (left, right) =>
          left.publishedAt.localeCompare(right.publishedAt) ||
          left.videoId.localeCompare(right.videoId),
      )
      .flatMap((video, index) => mapVideo(video, index, source, warnings));

    if (errors.length > 0 || subscribers === undefined) {
      return { status: "failure", errors, warnings, metadata };
    }

    return {
      status: warnings.length > 0 ? "partial" : "success",
      rawChannelData: {
        collectedAt: source.collectedAt,
        creator: {
          id: source.creator.userId,
          displayName: source.creator.displayName,
          locale: source.creator.locale,
        },
        channel: {
          id: source.channel.channelId,
          creatorId: source.creator.userId,
          name: source.channel.title,
          createdAt: source.channel.publishedAt,
          language: source.channel.defaultLanguage,
          market: source.channel.country,
          subscribers,
          totalViews,
          totalVideos,
        },
        videos,
      },
      errors: [],
      warnings,
      metadata,
    };
  }
}

function mapVideo(
  video: YouTubeVideo,
  index: number,
  source: PersistedYouTubeChannelData,
  warnings: ChannelDataAdapterWarning[],
): ReadonlyArray<RawVideoMetrics> {
  const path = `$.videos[${index}]`;
  if (
    video.userId !== source.creator.userId ||
    video.channelId !== source.channel.channelId
  ) {
    warnings.push({
      severity: "warning",
      code: "MISSING_OPTIONAL_FIELD",
      path,
      message: "A video outside the authenticated channel was excluded.",
    });
    return [];
  }
  if (video.availabilityStatus !== "available") {
    warnings.push({
      severity: "warning",
      code: "MISSING_OPTIONAL_FIELD",
      path,
      message: "An unavailable video was excluded from analysis.",
    });
    return [];
  }
  const views = optionalCounter(
    video.viewCount,
    `${path}.viewCount`,
    warnings,
  );
  if (views === undefined) {
    warnings.push({
      severity: "warning",
      code: "MISSING_OPTIONAL_FIELD",
      path: `${path}.viewCount`,
      message: "A video without a safely representable view count was excluded.",
    });
    return [];
  }
  return [{
    id: video.videoId,
    title: video.title,
    publishedAt: video.publishedAt,
    views,
    likes: optionalCounter(video.likeCount, `${path}.likeCount`, warnings),
    comments: optionalCounter(
      video.commentCount,
      `${path}.commentCount`,
      warnings,
    ),
    durationSeconds: video.durationSeconds,
    ...analyticsMetrics(source.analytics?.find((item) => item.videoId === video.videoId)),
  }];
}

function analyticsMetrics(value: VideoAnalyticsProjection | undefined) {
  if (!value) return {};
  return {
    ...(safeDecimal(value.values.averageViewDuration) === undefined ? {} : { averageViewDurationSeconds: safeDecimal(value.values.averageViewDuration) }),
    ...(safePercentage(value.values.averageViewPercentage) === undefined ? {} : { averagePercentageViewed: safePercentage(value.values.averageViewPercentage) }),
    ...(safeCounter(value.values.subscribersGained) === undefined ? {} : { subscribersGained: safeCounter(value.values.subscribersGained) }),
  };
}

function safeDecimal(value: string | undefined): number | undefined { if (value === undefined) return undefined; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; }
function safePercentage(value: string | undefined): number | undefined { const parsed = safeDecimal(value); return parsed !== undefined && parsed <= 100 ? parsed : undefined; }
function safeCounter(value: string | undefined): number | undefined { const parsed = safeDecimal(value); return parsed !== undefined && Number.isSafeInteger(parsed) ? parsed : undefined; }

function requiredCounter(
  value: string | undefined,
  path: string,
  errors: ChannelDataAdapterError[],
): number | undefined {
  if (value === undefined) {
    errors.push({
      severity: "error",
      code: "MISSING_REQUIRED_FIELD",
      path,
      message: "A required persisted counter is unavailable.",
    });
    return undefined;
  }
  const parsed = Number(value);
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(parsed)) {
    errors.push({
      severity: "error",
      code: "NON_FINITE_NUMBER",
      path,
      message: "A required persisted counter cannot be represented safely.",
    });
    return undefined;
  }
  return parsed;
}

function optionalCounter(
  value: string | undefined,
  path: string,
  warnings: ChannelDataAdapterWarning[],
): number | undefined {
  if (value === undefined) {
    warnings.push({
      severity: "warning",
      code: "MISSING_OPTIONAL_FIELD",
      path,
      message: "Optional provider counter is unavailable and was not invented.",
    });
    return undefined;
  }
  const parsed = Number(value);
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(parsed)) {
    warnings.push({
      severity: "warning",
      code: "UNSAFE_INTEGER_OMITTED",
      path,
      message: "Provider counter exceeds the safe numeric boundary and was omitted.",
    });
    return undefined;
  }
  return parsed;
}
