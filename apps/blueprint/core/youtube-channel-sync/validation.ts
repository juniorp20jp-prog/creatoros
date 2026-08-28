import type { YouTubeChannelSnapshot } from "./models";

const COUNT_PATTERN = /^(0|[1-9]\d*)$/u;

export function normalizeChannelSnapshot(input: YouTubeChannelSnapshot): YouTubeChannelSnapshot | undefined {
  const channelId = input.channelId.trim();
  const title = input.title.trim();
  const publishedAt = canonicalTimestamp(input.publishedAt);
  if (!channelId || !title || !publishedAt || !COUNT_PATTERN.test(input.viewCount) || !COUNT_PATTERN.test(input.videoCount) || (input.subscriberCount !== undefined && !COUNT_PATTERN.test(input.subscriberCount))) return undefined;
  if (input.privacyStatus !== "public" && input.privacyStatus !== "unlisted" && input.privacyStatus !== "private") return undefined;
  const keywords = [...new Set(input.keywords.map((value) => value.trim()).filter(Boolean))].sort();
  return {
    ...input,
    channelId,
    title,
    description: input.description.trim(),
    publishedAt,
    ...(optional(input.handle) ? { handle: optional(input.handle) } : {}),
    ...(optional(input.country) ? { country: optional(input.country) } : {}),
    ...(optional(input.customUrl) ? { customUrl: optional(input.customUrl) } : {}),
    ...(optional(input.thumbnailUrl) ? { thumbnailUrl: optional(input.thumbnailUrl) } : {}),
    ...(optional(input.bannerUrl) ? { bannerUrl: optional(input.bannerUrl) } : {}),
    ...(optional(input.defaultLanguage) ? { defaultLanguage: optional(input.defaultLanguage) } : {}),
    ...(optional(input.sourceEtag) ? { sourceEtag: optional(input.sourceEtag) } : {}),
    keywords,
    brandingSettings: { ...input.brandingSettings, keywords: [...new Set(input.brandingSettings.keywords.map((value) => value.trim()).filter(Boolean))].sort() },
  };
}

export const CHANNEL_SNAPSHOT_FIELDS = ["title", "handle", "description", "publishedAt", "country", "customUrl", "thumbnailUrl", "bannerUrl", "subscriberCount", "viewCount", "videoCount", "hiddenSubscriberCount", "defaultLanguage", "keywords", "brandingSettings", "privacyStatus", "sourceEtag"] as const;

export function changedChannelFields(current: YouTubeChannelSnapshot | undefined, next: YouTubeChannelSnapshot): ReadonlyArray<string> {
  if (!current) return [...CHANNEL_SNAPSHOT_FIELDS];
  return CHANNEL_SNAPSHOT_FIELDS.filter((field) => JSON.stringify(current[field]) !== JSON.stringify(next[field]));
}

function optional(value: string | undefined): string | undefined { const normalized = value?.trim(); return normalized || undefined; }
function canonicalTimestamp(value: string): string | undefined { const parsed = new Date(value); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value ? value : undefined; }
