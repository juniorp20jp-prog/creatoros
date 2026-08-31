import type { Locale } from "../../../i18n/config";
import type {
  YouTubeApiDataEnvelope,
  YouTubeApiErrorEnvelope,
  YouTubeChannelReadModel,
  YouTubeConnectionReadModel,
  YouTubeSynchronizationResultReadModel,
  YouTubeSynchronizationStatusReadModel,
} from "../../../server/youtube/http-contracts";

export type YouTubeClientErrorKind =
  | "unauthenticated"
  | "not-connected"
  | "authorization"
  | "provider"
  | "server"
  | "invalid-response"
  | "network"
  | "cancelled";

export class YouTubeApiClientError extends Error {
  constructor(
    readonly kind: YouTubeClientErrorKind,
    readonly retryable: boolean,
  ) {
    super(`YouTube request failed (${kind}).`);
    this.name = "YouTubeApiClientError";
  }
}

export type YouTubeApiClientOptions = Readonly<{
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}>;

export class YouTubeApiClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof globalThis.fetch;

  constructor(options: YouTubeApiClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "");
    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new Error("YouTubeApiClient requires a fetch implementation.");
    }
    this.fetchImplementation = fetchImplementation.bind(globalThis);
  }

  getConnectUrl(locale: Locale): string {
    const returnTo = `/${locale}/youtube-analyzer`;
    return `${this.baseUrl}/api/youtube/connect?returnTo=${encodeURIComponent(returnTo)}`;
  }

  getConnectionStatus(signal?: AbortSignal): Promise<YouTubeConnectionReadModel> {
    return this.request("/api/youtube/status", { method: "GET", signal }, isConnectionStatus);
  }

  getChannel(signal?: AbortSignal): Promise<YouTubeChannelReadModel | null> {
    return this.request("/api/youtube/channel", { method: "GET", signal }, isNullableChannel);
  }

  getSynchronizationStatus(signal?: AbortSignal): Promise<YouTubeSynchronizationStatusReadModel> {
    return this.request("/api/youtube/channel/status", { method: "GET", signal }, isSynchronizationStatus);
  }

  synchronize(signal?: AbortSignal): Promise<YouTubeSynchronizationResultReadModel> {
    return this.request("/api/youtube/channel/sync", { method: "POST", signal }, isSynchronizationResult);
  }

  disconnect(signal?: AbortSignal): Promise<YouTubeConnectionReadModel> {
    return this.request("/api/youtube/disconnect", { method: "POST", signal }, isConnectionStatus);
  }

  private async request<TData>(
    path: string,
    init: RequestInit,
    validate: (value: unknown) => value is TData,
  ): Promise<TData> {
    try {
      const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
        ...init,
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw mapHttpError(response.status, payload);
      }
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

function mapHttpError(status: number, payload: unknown): YouTubeApiClientError {
  const code = isErrorEnvelope(payload) ? payload.error.code : "";
  if (status === 401) return new YouTubeApiClientError("unauthenticated", false);
  if (code === "YOUTUBE_NOT_CONNECTED") return new YouTubeApiClientError("not-connected", false);
  if (code === "YOUTUBE_AUTHORIZATION_EXPIRED" || code === "YOUTUBE_REVOCATION_FAILED") {
    return new YouTubeApiClientError("authorization", false);
  }
  if (status === 429 || status === 502 || code === "YOUTUBE_CHANNEL_PRIVATE" || code === "YOUTUBE_CHANNEL_NOT_FOUND") {
    return new YouTubeApiClientError("provider", status === 429 || status === 502);
  }
  return new YouTubeApiClientError("server", status >= 500);
}

function isDataEnvelope(value: unknown): value is YouTubeApiDataEnvelope<unknown> {
  return isRecord(value) && "data" in value;
}

function isErrorEnvelope(value: unknown): value is YouTubeApiErrorEnvelope {
  return isRecord(value) && isRecord(value.error) && typeof value.error.code === "string" && typeof value.error.message === "string";
}

function isConnectionStatus(value: unknown): value is YouTubeConnectionReadModel {
  if (!isRecord(value) || typeof value.connected !== "boolean" || !isStringArray(value.scopes)) return false;
  return optionalString(value.channelId) && optionalString(value.channelTitle) && optionalString(value.connectedAt) && optionalString(value.updatedAt);
}

function isNullableChannel(value: unknown): value is YouTubeChannelReadModel | null {
  return value === null || isChannel(value);
}

function isChannel(value: unknown): value is YouTubeChannelReadModel {
  return isRecord(value)
    && requiredStrings(value, ["channelId", "title", "description", "publishedAt", "viewCount", "videoCount", "privacyStatus", "lastSyncedAt", "syncStatus", "createdAt", "updatedAt"])
    && optionalString(value.handle)
    && optionalString(value.country)
    && optionalString(value.customUrl)
    && optionalString(value.thumbnailUrl)
    && optionalString(value.bannerUrl)
    && optionalString(value.subscriberCount)
    && optionalString(value.defaultLanguage)
    && optionalString(value.sourceEtag)
    && typeof value.hiddenSubscriberCount === "boolean"
    && isStringArray(value.keywords)
    && isRecord(value.brandingSettings)
    && isUnsignedIntegerString(value.viewCount)
    && isUnsignedIntegerString(value.videoCount)
    && (value.subscriberCount === undefined || isUnsignedIntegerString(value.subscriberCount));
}

function isSynchronizationStatus(value: unknown): value is YouTubeSynchronizationStatusReadModel {
  return isRecord(value)
    && typeof value.channelConnected === "boolean"
    && (value.lastSync === null || isSynchronization(value.lastSync));
}

function isSynchronizationResult(value: unknown): value is YouTubeSynchronizationResultReadModel {
  return isRecord(value) && isChannel(value.channel) && isSynchronization(value.synchronization);
}

function isSynchronization(value: unknown): boolean {
  return isRecord(value)
    && requiredStrings(value, ["outcome", "startedAt", "completedAt"])
    && optionalString(value.channelId)
    && optionalString(value.failureCode)
    && isStringArray(value.changedFields)
    && typeof value.outcome === "string"
    && ["completed", "no-change", "failed"].includes(value.outcome);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is ReadonlyArray<string> {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function requiredStrings(value: Readonly<Record<string, unknown>>, keys: ReadonlyArray<string>): boolean {
  return keys.every((key) => typeof value[key] === "string");
}

function isUnsignedIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/u.test(value);
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
