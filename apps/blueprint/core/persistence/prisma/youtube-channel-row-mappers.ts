import type { ChannelSynchronization, YouTubeBrandingSettings, YouTubeChannel, YouTubeChannelPrivacyStatus } from "../../youtube-channel-sync";
import type { ChannelSyncRow, YouTubeChannelRow } from "./generated/client";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export function mapYouTubeChannelRow(row: YouTubeChannelRow): YouTubeChannel | undefined {
  const brandingSettings = mapBrandingSettings(row.brandingSettings);
  if (!brandingSettings || !["public", "unlisted", "private"].includes(row.privacyStatus) || row.syncStatus !== "synced") return undefined;
  return { channelId: row.channelId, userId: row.userId, youtubeIdentityId: row.youtubeIdentityId, title: row.title, ...(row.handle ? { handle: row.handle } : {}), description: row.description, publishedAt: row.publishedAt.toISOString(), ...(row.country ? { country: row.country } : {}), ...(row.customUrl ? { customUrl: row.customUrl } : {}), ...(row.thumbnailUrl ? { thumbnailUrl: row.thumbnailUrl } : {}), ...(row.bannerUrl ? { bannerUrl: row.bannerUrl } : {}), ...(row.subscriberCount !== null ? { subscriberCount: row.subscriberCount.toString() } : {}), viewCount: row.viewCount.toString(), videoCount: row.videoCount.toString(), hiddenSubscriberCount: row.hiddenSubscriberCount, ...(row.defaultLanguage ? { defaultLanguage: row.defaultLanguage } : {}), keywords: [...row.keywords], brandingSettings, privacyStatus: row.privacyStatus as YouTubeChannelPrivacyStatus, ...(row.sourceEtag ? { sourceEtag: row.sourceEtag } : {}), lastSyncedAt: row.lastSyncedAt.toISOString(), syncStatus: "synced", createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export function mapChannelSyncRow(row: ChannelSyncRow): ChannelSynchronization | undefined {
  if (!["completed", "no-change", "failed"].includes(row.outcome) || (row.outcome === "failed") !== Boolean(row.failureCode)) return undefined;
  return { syncId: row.syncId, userId: row.userId, youtubeIdentityId: row.youtubeIdentityId, ...(row.channelId ? { channelId: row.channelId } : {}), outcome: row.outcome as ChannelSynchronization["outcome"], changedFields: [...row.changedFields], ...(row.failureCode ? { failureCode: row.failureCode } : {}), startedAt: row.startedAt.toISOString(), completedAt: row.completedAt.toISOString() };
}

function mapBrandingSettings(value: unknown): YouTubeBrandingSettings | undefined {
  if (!isRecord(value) || !Array.isArray(value.keywords) || value.keywords.some((item) => typeof item !== "string")) return undefined;
  for (const key of ["title", "description", "defaultLanguage", "country", "bannerUrl"] as const) if (value[key] !== undefined && typeof value[key] !== "string") return undefined;
  return { ...(typeof value.title === "string" ? { title: value.title } : {}), ...(typeof value.description === "string" ? { description: value.description } : {}), ...(typeof value.defaultLanguage === "string" ? { defaultLanguage: value.defaultLanguage } : {}), ...(typeof value.country === "string" ? { country: value.country } : {}), keywords: value.keywords as string[], ...(typeof value.bannerUrl === "string" ? { bannerUrl: value.bannerUrl } : {}) };
}
