import type { YouTubeApiAdapter, YouTubeBrandingSettings, YouTubeChannelApiResult, YouTubeChannelPrivacyStatus, YouTubeChannelSnapshot } from "../../core";

const CHANNEL_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics%2CbrandingSettings%2Cstatus&mine=true&maxResults=1";

export class GoogleYouTubeApiAdapter implements YouTubeApiAdapter {
  constructor(private readonly request: typeof fetch = fetch) {}

  async fetchAuthenticatedChannel(accessToken: string, sourceEtag?: string): Promise<YouTubeChannelApiResult> {
    try {
      const headers = new Headers({ authorization: `Bearer ${accessToken}`, accept: "application/json" });
      if (sourceEtag) headers.set("if-none-match", sourceEtag);
      const response = await this.request(CHANNEL_ENDPOINT, { method: "GET", headers, cache: "no-store" });
      if (response.status === 304) return { status: "not-modified" };
      if (!response.ok) return apiFailure(response.status, await safeReason(response));
      const body: unknown = await response.json();
      return mapResponse(body);
    } catch { return failure("api-failure", "YouTube API request failed."); }
  }
}

function mapResponse(body: unknown): YouTubeChannelApiResult {
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0) return failure("channel-not-found", "YouTube channel was not found.");
  const item = body.items[0];
  if (!isRecord(item)) return failure("api-failure", "YouTube API response was invalid.");
  const snippet = record(item.snippet);
  const statistics = record(item.statistics);
  const branding = record(item.brandingSettings);
  const brandingChannel = record(branding?.channel);
  const brandingImage = record(branding?.image);
  const status = record(item.status);
  const privacyStatus = status?.privacyStatus;
  const channelId = string(item.id);
  const title = string(snippet?.title);
  const description = string(snippet?.description);
  const publishedAt = timestamp(snippet?.publishedAt);
  const viewCount = count(statistics?.viewCount);
  const videoCount = count(statistics?.videoCount);
  if (!channelId || !title || description === undefined || !publishedAt || !viewCount || !videoCount || !isPrivacyStatus(privacyStatus)) return failure("api-failure", "YouTube API response was invalid.");
  const customUrl = string(snippet?.customUrl);
  const keywords = parseKeywords(string(brandingChannel?.keywords));
  const bannerUrl = string(brandingImage?.bannerExternalUrl);
  const brandingSettings: YouTubeBrandingSettings = { ...(string(brandingChannel?.title) ? { title: string(brandingChannel?.title) } : {}), ...(string(brandingChannel?.description) !== undefined ? { description: string(brandingChannel?.description) } : {}), ...(string(brandingChannel?.defaultLanguage) ? { defaultLanguage: string(brandingChannel?.defaultLanguage) } : {}), ...(string(brandingChannel?.country) ? { country: string(brandingChannel?.country) } : {}), keywords, ...(bannerUrl ? { bannerUrl } : {}) };
  const snapshot: YouTubeChannelSnapshot = {
    channelId,
    title,
    ...(customUrl?.startsWith("@") ? { handle: customUrl } : {}),
    description,
    publishedAt,
    ...(string(snippet?.country) ? { country: string(snippet?.country) } : {}),
    ...(customUrl ? { customUrl } : {}),
    ...(thumbnailUrl(snippet) ? { thumbnailUrl: thumbnailUrl(snippet) } : {}),
    ...(bannerUrl ? { bannerUrl } : {}),
    ...(!boolean(statistics?.hiddenSubscriberCount) && count(statistics?.subscriberCount) ? { subscriberCount: count(statistics?.subscriberCount) } : {}),
    viewCount,
    videoCount,
    hiddenSubscriberCount: boolean(statistics?.hiddenSubscriberCount),
    ...(string(snippet?.defaultLanguage) ? { defaultLanguage: string(snippet?.defaultLanguage) } : {}),
    keywords,
    brandingSettings,
    privacyStatus,
    ...(string(item.etag) ? { sourceEtag: string(item.etag) } : {}),
  };
  return { status: "success", value: snapshot };
}

async function safeReason(response: Response): Promise<string | undefined> { try { const body: unknown = await response.json(); if (!isRecord(body)) return undefined; const error = record(body.error); const errors = Array.isArray(error?.errors) ? error.errors : []; const first = errors[0]; return isRecord(first) ? string(first.reason) : undefined; } catch { return undefined; } }
function apiFailure(status: number, reason: string | undefined): YouTubeChannelApiResult { if (status === 401) return failure("unauthorized", "YouTube authorization expired."); if (status === 403 && reason === "quotaExceeded") return failure("quota-exceeded", "YouTube API quota was exceeded."); if (["channelNotFound", "channelClosed", "channelSuspended", "youtubeSignupRequired"].includes(reason ?? "")) return failure("channel-not-found", "YouTube channel was not found."); if (status === 403) return failure("forbidden", "YouTube API access was denied."); return failure("api-failure", "YouTube API request failed."); }
function failure(code: "unauthorized" | "channel-not-found" | "quota-exceeded" | "forbidden" | "api-failure", message: string): YouTubeChannelApiResult { return { status: "failure", error: { code, message } }; }
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function record(value: unknown): Readonly<Record<string, unknown>> | undefined { return isRecord(value) ? value : undefined; }
function string(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function boolean(value: unknown): boolean { return value === true; }
function count(value: unknown): string | undefined { return typeof value === "string" && /^(0|[1-9]\d*)$/u.test(value) ? value : undefined; }
function timestamp(value: unknown): string | undefined { if (typeof value !== "string") return undefined; const parsed = new Date(value); return !Number.isNaN(parsed.valueOf()) ? parsed.toISOString() : undefined; }
function isPrivacyStatus(value: unknown): value is YouTubeChannelPrivacyStatus { return value === "public" || value === "unlisted" || value === "private"; }
function thumbnailUrl(snippet: Readonly<Record<string, unknown>> | undefined): string | undefined { const thumbnails = record(snippet?.thumbnails); for (const key of ["maxres", "high", "medium", "default"]) { const url = string(record(thumbnails?.[key])?.url); if (url) return url; } return undefined; }
function parseKeywords(value: string | undefined): ReadonlyArray<string> { if (!value) return []; const matches = value.match(/"[^"]+"|\S+/gu) ?? []; return [...new Set(matches.map((item) => item.replace(/^"|"$/gu, "").trim()).filter(Boolean))].sort(); }
