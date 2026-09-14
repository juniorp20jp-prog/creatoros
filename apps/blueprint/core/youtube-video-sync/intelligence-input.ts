import type { YouTubeChannel } from "../youtube-channel-sync";
import type {
  YouTubeIntelligenceInput,
  YouTubeVideoInput,
} from "../engines/youtube-intelligence";
import type { YouTubeVideo } from "./models";
import type { VideoAnalyticsProjection } from "../youtube-analytics";

export type RealYouTubeIntelligenceMapping =
  | Readonly<{
      status: "success";
      value: Readonly<{
        input: YouTubeIntelligenceInput;
        excludedVideoCount: number;
      }>;
    }>
  | Readonly<{
      status: "failure";
      error: Readonly<{
        code: "insufficient-channel-data" | "insufficient-video-data";
        message: string;
      }>;
    }>;

export function mapPersistedYouTubeDataToIntelligenceInput(
  channel: YouTubeChannel,
  videos: ReadonlyArray<YouTubeVideo>,
  analysisDate: string,
  analytics: ReadonlyArray<VideoAnalyticsProjection> = [],
): RealYouTubeIntelligenceMapping {
  const subscribers = safeInteger(channel.subscriberCount);
  if (subscribers === undefined) {
    return {
      status: "failure",
      error: {
        code: "insufficient-channel-data",
        message: "Subscriber count is unavailable or unsafe.",
      },
    };
  }

  const mappedVideos: YouTubeVideoInput[] = [];
  for (const video of videos) {
    const views = safeInteger(video.viewCount);
    if (
      views === undefined ||
      video.availabilityStatus !== "available" ||
      !Number.isSafeInteger(video.durationSeconds)
    ) continue;
    const likes = safeInteger(video.likeCount);
    const comments = safeInteger(video.commentCount);
    const privateMetrics = analytics.find((item) => item.videoId === video.videoId)?.values;
    mappedVideos.push({
      id: video.videoId,
      title: video.title,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
      views,
      ...(video.likeCount !== undefined && likes !== undefined ? { likes } : {}),
      ...(video.commentCount !== undefined && comments !== undefined
        ? { comments }
        : {}),
      ...(safeDecimal(privateMetrics?.averageViewDuration) === undefined ? {} : { averageViewDurationSeconds: safeDecimal(privateMetrics?.averageViewDuration) }),
      ...(safePercentage(privateMetrics?.averageViewPercentage) === undefined ? {} : { averagePercentageViewed: safePercentage(privateMetrics?.averageViewPercentage) }),
      ...(safeInteger(privateMetrics?.subscribersGained) === undefined ? {} : { subscribersGained: safeInteger(privateMetrics?.subscribersGained) }),
    });
  }

  if (videos.length > 0 && mappedVideos.length === 0) {
    return {
      status: "failure",
      error: {
        code: "insufficient-video-data",
        message: "No stored videos contain safe public metrics.",
      },
    };
  }
  const ordered = [...mappedVideos].sort((left, right) =>
    left.publishedAt.localeCompare(right.publishedAt),
  );
  const startDate = ordered[0]?.publishedAt ?? analysisDate;
  const endDate = ordered.at(-1)?.publishedAt ?? analysisDate;
  const totalViews = safeInteger(channel.viewCount);
  const totalVideos = safeInteger(channel.videoCount);
  return {
    status: "success",
    value: {
      input: {
        channel: {
          id: channel.channelId,
          name: channel.title,
          createdAt: channel.publishedAt,
          subscribers,
          ...(totalViews === undefined ? {} : { totalViews }),
          ...(totalVideos === undefined ? {} : { totalVideos }),
          ...(channel.defaultLanguage
            ? { languageOrMarket: channel.defaultLanguage }
            : channel.country
              ? { languageOrMarket: channel.country }
              : {}),
        },
        videos: mappedVideos,
        context: {
          analysisDate,
          period: { startDate, endDate },
          ...(channel.country ? { market: channel.country } : {}),
        },
      },
      excludedVideoCount: videos.length - mappedVideos.length,
    },
  };
}

function safeDecimal(value: string | undefined): number | undefined { if (value === undefined) return undefined; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; }
function safePercentage(value: string | undefined): number | undefined { const parsed = safeDecimal(value); return parsed !== undefined && parsed <= 100 ? parsed : undefined; }

function safeInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^(0|[1-9]\d*)$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
