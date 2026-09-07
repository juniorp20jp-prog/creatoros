import type {
  RealYouTubeIntelligenceReadModel,
  YouTubeApiDataEnvelope,
  YouTubeApiErrorEnvelope,
  YouTubeVideoPageReadModel,
  YouTubeVideoSynchronizationResultReadModel,
  YouTubeVideoSynchronizationStatusReadModel,
} from "../../../server/youtube/http-contracts";
import {
  YouTubeApiClientError,
  type YouTubeClientErrorKind,
} from "../../youtube-connection/client/youtube-api-client";

export class YouTubeVideoApiClient {
  constructor(
    private readonly requestImplementation: typeof globalThis.fetch =
      globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "",
  ) {}

  list(
    input: Readonly<{ limit?: number; cursor?: string }> = {},
    signal?: AbortSignal,
  ): Promise<YouTubeVideoPageReadModel> {
    const query = new URLSearchParams();
    if (input.limit !== undefined) query.set("limit", String(input.limit));
    if (input.cursor) query.set("cursor", input.cursor);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.request(
      `/api/youtube/videos${suffix}`,
      { method: "GET", signal },
      isVideoPage,
    );
  }

  status(signal?: AbortSignal): Promise<YouTubeVideoSynchronizationStatusReadModel> {
    return this.request(
      "/api/youtube/videos/status",
      { method: "GET", signal },
      isVideoStatus,
    );
  }

  synchronize(signal?: AbortSignal): Promise<YouTubeVideoSynchronizationResultReadModel> {
    return this.request(
      "/api/youtube/videos/sync",
      { method: "POST", signal },
      isSynchronizationResult,
    );
  }

  analyze(signal?: AbortSignal): Promise<RealYouTubeIntelligenceReadModel> {
    return this.request(
      "/api/youtube/intelligence",
      { method: "POST", signal },
      isIntelligence,
    );
  }

  private async request<TValue>(
    path: string,
    init: RequestInit,
    validate: (value: unknown) => value is TValue,
  ): Promise<TValue> {
    try {
      const response = await this.requestImplementation(
        `${this.baseUrl}${path}`,
        {
          ...init,
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        },
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw mapError(response.status, payload);
      if (!isDataEnvelope(payload) || !validate(payload.data)) {
        throw new YouTubeApiClientError("invalid-response", false);
      }
      return payload.data;
    } catch (error) {
      if (error instanceof YouTubeApiClientError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new YouTubeApiClientError("cancelled", false);
      }
      throw new YouTubeApiClientError("network", true);
    }
  }
}

function mapError(status: number, payload: unknown): YouTubeApiClientError {
  const code = isErrorEnvelope(payload) ? payload.error.code : "";
  if (status === 401) return new YouTubeApiClientError("unauthenticated", false);
  if (code === "YOUTUBE_NOT_CONNECTED") {
    return new YouTubeApiClientError("not-connected", false);
  }
  if (code === "YOUTUBE_AUTHORIZATION_EXPIRED") {
    return new YouTubeApiClientError("authorization", false);
  }
  if (status === 429 || status === 502) {
    return new YouTubeApiClientError("provider", true);
  }
  return new YouTubeApiClientError("server", status >= 500);
}
function isDataEnvelope(value: unknown): value is YouTubeApiDataEnvelope<unknown> {
  return isRecord(value) && "data" in value;
}
function isErrorEnvelope(value: unknown): value is YouTubeApiErrorEnvelope {
  return isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string";
}
function isVideoPage(value: unknown): value is YouTubeVideoPageReadModel {
  return isRecord(value) &&
    Array.isArray(value.videos) &&
    value.videos.every(isVideo) &&
    (value.nextCursor === undefined || typeof value.nextCursor === "string");
}
function isVideoStatus(
  value: unknown,
): value is YouTubeVideoSynchronizationStatusReadModel {
  return isRecord(value) &&
    typeof value.videoCount === "number" &&
    (value.lastSync === null || isSynchronization(value.lastSync));
}
function isSynchronizationResult(
  value: unknown,
): value is YouTubeVideoSynchronizationResultReadModel {
  return isRecord(value) &&
    Array.isArray(value.videos) &&
    value.videos.every(isVideo) &&
    isSynchronization(value.synchronization);
}
function isIntelligence(value: unknown): value is RealYouTubeIntelligenceReadModel {
  return isRecord(value) &&
    isRecord(value.output) &&
    isRecord(value.output.summary) &&
    Array.isArray(value.output.videos) &&
    Array.isArray(value.output.signals) &&
    isRecord(value.output.dataQuality) &&
    typeof value.excludedVideoCount === "number" &&
    (value.synchronization === null || isSynchronization(value.synchronization));
}
function isVideo(value: unknown): boolean {
  return isRecord(value) &&
    ["videoId", "channelId", "title", "description", "publishedAt", "availabilityStatus", "lastSeenAt", "lastSyncedAt", "createdAt", "updatedAt"].every(
      (key) => typeof value[key] === "string",
    ) &&
    typeof value.durationSeconds === "number";
}
function isSynchronization(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.counts)) return false;
  const counts = value.counts;
  return typeof value.channelId === "string" &&
    typeof value.outcome === "string" &&
    ["discovered", "created", "updated", "unchanged", "unavailable"].every(
      (key) => typeof counts[key] === "number",
    ) &&
    typeof value.coverageCount === "number" &&
    typeof value.coverageLimit === "number" &&
    typeof value.truncated === "boolean" &&
    typeof value.startedAt === "string" &&
    typeof value.completedAt === "string";
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { YouTubeClientErrorKind };
