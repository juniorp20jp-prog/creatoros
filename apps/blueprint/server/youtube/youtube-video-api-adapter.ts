import type {
  YouTubeVideoApiAdapter,
  YouTubeVideoApiResult,
  YouTubeVideoApiErrorCode,
  YouTubeVideoPrivacyStatus,
  YouTubeVideoSnapshot,
} from "../../core";
import { parseYouTubeDurationSeconds } from "../../core";

const API_ROOT = "https://www.googleapis.com/youtube/v3";

export class GoogleYouTubeVideoApiAdapter implements YouTubeVideoApiAdapter {
  constructor(private readonly request: typeof fetch = fetch) {}

  async fetchUploadVideoWindow(
    accessToken: string,
    input: Readonly<{ limit: number; pageCursor?: string }>,
  ): Promise<YouTubeVideoApiResult> {
    try {
      const limit = Math.min(Math.max(input.limit, 1), 100);
      const channelResponse = await this.get(
        "/channels",
        {
          part: "contentDetails",
          mine: "true",
          maxResults: "1",
        },
        accessToken,
      );
      if (!channelResponse.ok) return apiFailure(channelResponse);
      const channelBody: unknown = await channelResponse.json();
      const channel = firstItem(channelBody);
      const channelId = string(channel?.id);
      const uploads = string(
        record(record(channel?.contentDetails)?.relatedPlaylists)?.uploads,
      );
      if (!channelId || !uploads) {
        return failure("channel-not-found", "YouTube uploads playlist was not found.");
      }

      const videos: YouTubeVideoSnapshot[] = [];
      const seenVideoIds = new Set<string>();
      const seenPageCursors = new Set<string>();
      let discovered = 0;
      let unavailable = 0;
      let pageCursor = input.pageCursor;
      let nextPageCursor: string | undefined;

      do {
        if (pageCursor) {
          if (seenPageCursors.has(pageCursor)) {
            return failure("api-failure", "YouTube playlist pagination was invalid.");
          }
          seenPageCursors.add(pageCursor);
        }
        const playlistResponse = await this.get(
          "/playlistItems",
          {
            part: "contentDetails",
            playlistId: uploads,
            maxResults: String(Math.min(50, limit - videos.length)),
            ...(pageCursor ? { pageToken: pageCursor } : {}),
          },
          accessToken,
        );
        if (!playlistResponse.ok) return apiFailure(playlistResponse);
        const playlistBody: unknown = await playlistResponse.json();
        if (!isRecord(playlistBody) || !Array.isArray(playlistBody.items)) {
          return failure("api-failure", "YouTube playlist response was invalid.");
        }

        const batch: string[] = [];
        for (const item of playlistBody.items) {
          const videoId = string(record(record(item)?.contentDetails)?.videoId);
          if (videoId && !seenVideoIds.has(videoId)) {
            seenVideoIds.add(videoId);
            batch.push(videoId);
          }
        }
        discovered += batch.length;

        if (batch.length > 0) {
          const videosResponse = await this.get(
            "/videos",
            {
              part: "snippet,contentDetails,statistics,status",
              id: batch.join(","),
              maxResults: String(batch.length),
            },
            accessToken,
          );
          if (!videosResponse.ok) return apiFailure(videosResponse);
          const videosBody: unknown = await videosResponse.json();
          if (!isRecord(videosBody) || !Array.isArray(videosBody.items)) {
            return failure("api-failure", "YouTube videos response was invalid.");
          }
          const mappedById = new Map<string, YouTubeVideoSnapshot>();
          for (const item of videosBody.items) {
            const mapped = mapVideo(item);
            if (mapped) mappedById.set(mapped.videoId, mapped);
          }
          unavailable += batch.length - mappedById.size;
          for (const videoId of batch) {
            const mapped = mappedById.get(videoId);
            if (mapped && videos.length < limit) videos.push(mapped);
          }
        }

        nextPageCursor = string(playlistBody.nextPageToken);
        pageCursor = nextPageCursor;
      } while (videos.length < limit && pageCursor);

      return {
        status: "success",
        value: {
          channelId,
          videos,
          discovered,
          unavailable,
          coverageCount: videos.length,
          coverageLimit: limit,
          truncated: Boolean(nextPageCursor),
          ...(nextPageCursor ? { nextPageCursor } : {}),
        },
      };
    } catch {
      return failure("api-failure", "YouTube API request failed.");
    }
  }

  private get(
    path: string,
    parameters: Readonly<Record<string, string>>,
    accessToken: string,
  ): Promise<Response> {
    const query = new URLSearchParams(parameters);
    return this.request(`${API_ROOT}${path}?${query.toString()}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
      cache: "no-store",
    });
  }
}

function mapVideo(value: unknown): YouTubeVideoSnapshot | undefined {
  const item = record(value);
  const snippet = record(item?.snippet);
  const details = record(item?.contentDetails);
  const statistics = record(item?.statistics);
  const status = record(item?.status);
  const videoId = string(item?.id);
  const channelId = string(snippet?.channelId);
  const title = string(snippet?.title);
  const description = string(snippet?.description);
  const publishedAt = timestamp(snippet?.publishedAt);
  const durationSeconds = parseYouTubeDurationSeconds(string(details?.duration) ?? "");
  if (
    !videoId ||
    !channelId ||
    !title ||
    description === undefined ||
    !publishedAt ||
    durationSeconds === undefined
  ) return undefined;

  const privacyStatus = privacy(status?.privacyStatus);
  const viewCount = count(statistics?.viewCount);
  const likeCount = count(statistics?.likeCount);
  const commentCount = count(statistics?.commentCount);
  const tags = Array.isArray(snippet?.tags)
    ? snippet.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;
  return {
    videoId,
    channelId,
    title,
    description,
    publishedAt,
    ...(thumbnailUrl(snippet) ? { thumbnailUrl: thumbnailUrl(snippet) } : {}),
    durationSeconds,
    ...(viewCount === undefined ? {} : { viewCount }),
    ...(likeCount === undefined ? {} : { likeCount }),
    ...(commentCount === undefined ? {} : { commentCount }),
    ...(privacyStatus === undefined ? {} : { privacyStatus }),
    ...(tags === undefined ? {} : { tags }),
    ...(string(snippet?.categoryId)
      ? { categoryId: string(snippet?.categoryId) }
      : {}),
    ...(string(snippet?.defaultLanguage)
      ? { defaultLanguage: string(snippet?.defaultLanguage) }
      : {}),
    ...(string(item?.etag) ? { sourceEtag: string(item?.etag) } : {}),
    availabilityStatus: privacyStatus === "private" ? "private" : "available",
  };
}

async function apiFailure(response: Response): Promise<YouTubeVideoApiResult> {
  const reason = await safeReason(response);
  if (response.status === 401) {
    return failure("unauthorized", "YouTube authorization expired.");
  }
  if (
    response.status === 403 &&
    ["quotaExceeded", "dailyLimitExceeded"].includes(reason ?? "")
  ) {
    return failure("quota-exceeded", "YouTube API quota was exceeded.");
  }
  if (
    ["channelNotFound", "channelClosed", "channelSuspended", "youtubeSignupRequired"].includes(
      reason ?? "",
    )
  ) {
    return failure("channel-not-found", "YouTube channel was not found.");
  }
  if (response.status === 403) {
    return failure("forbidden", "YouTube API access was denied.");
  }
  return failure("api-failure", "YouTube API request failed.");
}

async function safeReason(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const error = record(record(body)?.error);
    const errors = Array.isArray(error?.errors) ? error.errors : [];
    return string(record(errors[0])?.reason);
  } catch {
    return undefined;
  }
}
function failure(
  code: YouTubeVideoApiErrorCode,
  message: string,
): YouTubeVideoApiResult {
  return { status: "failure", error: { code, message } };
}
function firstItem(value: unknown): Readonly<Record<string, unknown>> | undefined {
  const items = record(value)?.items;
  return Array.isArray(items) ? record(items[0]) : undefined;
}
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined;
}
function string(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function count(value: unknown): string | undefined {
  return typeof value === "string" && /^(0|[1-9]\d*)$/u.test(value)
    ? value
    : undefined;
}
function timestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}
function privacy(value: unknown): YouTubeVideoPrivacyStatus | undefined {
  return value === "public" || value === "unlisted" || value === "private"
    ? value
    : undefined;
}
function thumbnailUrl(
  snippet: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const thumbnails = record(snippet?.thumbnails);
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const url = string(record(thumbnails?.[key])?.url);
    if (url) return url;
  }
  return undefined;
}
