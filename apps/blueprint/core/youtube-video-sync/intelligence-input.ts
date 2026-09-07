import type { YouTubeChannel } from "../youtube-channel-sync";
import type {
  YouTubeIntelligenceInput,
  YouTubeVideoInput,
} from "../engines/youtube-intelligence";
import type { YouTubeVideo } from "./models";

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

function safeInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^(0|[1-9]\d*)$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
