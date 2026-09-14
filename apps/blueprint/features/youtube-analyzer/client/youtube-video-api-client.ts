import type {
  RealYouTubeIntelligenceReadModel,
  YouTubeApiDataEnvelope,
  ChannelHistoryReadModel,
  ChannelTrendsReadModel,
  YouTubeApiErrorEnvelope,
  YouTubeVideoPageReadModel,
  YouTubeVideoSynchronizationResultReadModel,
  YouTubeVideoSynchronizationStatusReadModel,
  YouTubeAnalyticsStatusReadModel,
  YouTubeAnalyticsCollectionReadModel,
  YouTubeAnalyticsChannelReadModel,
  YouTubeAnalyticsVideosReadModel,
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

  history(signal?: AbortSignal): Promise<ChannelHistoryReadModel> {
    return this.request("/api/youtube/metrics/channel/history?limit=100", { method: "GET", signal }, isChannelHistory);
  }

  trends(period: "7d" | "30d" | "90d" = "30d", signal?: AbortSignal): Promise<ChannelTrendsReadModel> {
    return this.request(`/api/youtube/metrics/trends?period=${period}`, { method: "GET", signal }, isChannelTrends);
  }
  analyticsStatus(signal?: AbortSignal): Promise<YouTubeAnalyticsStatusReadModel> { return this.request("/api/youtube/analytics/status", { method: "GET", signal }, isAnalyticsStatus); }
  synchronizeAnalytics(period: "7d" | "30d" | "90d" = "30d", signal?: AbortSignal): Promise<YouTubeAnalyticsCollectionReadModel> { return this.request(`/api/youtube/analytics/sync?period=${period}`, { method: "POST", signal }, isAnalyticsBatch); }
  channelAnalytics(period: "7d" | "30d" | "90d" = "30d", signal?: AbortSignal): Promise<YouTubeAnalyticsChannelReadModel> { return this.request(`/api/youtube/analytics/channel?period=${period}`, { method: "GET", signal }, isChannelAnalytics); }
  videoAnalytics(period: "7d" | "30d" | "90d" = "30d", signal?: AbortSignal): Promise<YouTubeAnalyticsVideosReadModel> { return this.request(`/api/youtube/analytics/videos?period=${period}`, { method: "GET", signal }, isVideoAnalytics); }
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
function isChannelHistory(value: unknown): value is ChannelHistoryReadModel {
  return isRecord(value) && Array.isArray(value.observations) && value.observations.every((item) => isRecord(item) && isRecord(item.observation) && typeof item.observation.observedAt === "string" && isRecord(item.metrics)) && (value.nextCursor === undefined || typeof value.nextCursor === "string");
}
function isChannelTrends(value: unknown): value is ChannelTrendsReadModel {
  return isRecord(value) && ["7d", "30d", "90d"].includes(String(value.period)) && isRecord(value.freshness) && typeof value.freshness.state === "string" && Array.isArray(value.trends) && value.trends.every((trend) => isRecord(trend) && typeof trend.metric === "string" && typeof trend.state === "string");
}
function isAnalyticsStatus(value: unknown): value is YouTubeAnalyticsStatusReadModel { return isRecord(value) && ["not-authorized", "authorized", "declined", "revoked", "temporarily-unavailable"].includes(String(value.state)) && typeof value.updatedAt === "string"; }
function isAnalyticsBatch(value: unknown): value is YouTubeAnalyticsCollectionReadModel { return isRecord(value) && typeof value.batchId === "string" && typeof value.channelId === "string" && ["completed", "partial", "no-data"].includes(String(value.outcome)) && typeof value.channelRowCount === "number" && typeof value.videoRowCount === "number"; }
function isChannelAnalytics(value: unknown): value is YouTubeAnalyticsChannelReadModel { return isRecord(value) && ["7d", "30d", "90d"].includes(String(value.period)) && isRecord(value.values) && Array.isArray(value.availableFields) && Array.isArray(value.missingFields) && typeof value.channelDays === "number"; }
function isVideoAnalytics(value: unknown): value is YouTubeAnalyticsVideosReadModel { return isRecord(value) && ["7d", "30d", "90d"].includes(String(value.period)) && Array.isArray(value.videos) && value.videos.every((video) => isRecord(video) && typeof video.videoId === "string" && isRecord(video.values) && Array.isArray(video.availableFields)); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { YouTubeClientErrorKind };
