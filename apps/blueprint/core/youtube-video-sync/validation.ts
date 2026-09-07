import type { YouTubeVideo, YouTubeVideoSnapshot } from "./models";

const COUNT_PATTERN = /^(0|[1-9]\d*)$/u;

export const VIDEO_SNAPSHOT_FIELDS = [
  "channelId",
  "title",
  "description",
  "publishedAt",
  "thumbnailUrl",
  "durationSeconds",
  "viewCount",
  "likeCount",
  "commentCount",
  "privacyStatus",
  "tags",
  "categoryId",
  "defaultLanguage",
  "sourceEtag",
  "availabilityStatus",
] as const;

export function normalizeVideoSnapshot(
  input: YouTubeVideoSnapshot,
): YouTubeVideoSnapshot | undefined {
  const videoId = input.videoId.trim();
  const channelId = input.channelId.trim();
  const title = input.title.trim();
  const publishedAt = canonicalTimestamp(input.publishedAt);
  if (
    !videoId ||
    !channelId ||
    !title ||
    !publishedAt ||
    !Number.isSafeInteger(input.durationSeconds) ||
    input.durationSeconds < 0 ||
    !optionalCount(input.viewCount) ||
    !optionalCount(input.likeCount) ||
    !optionalCount(input.commentCount)
  ) return undefined;
  if (
    input.privacyStatus !== undefined &&
    !["public", "unlisted", "private"].includes(input.privacyStatus)
  ) return undefined;
  if (
    !["available", "private", "deleted", "unavailable"].includes(
      input.availabilityStatus,
    )
  ) return undefined;
  const tags = input.tags
    ? [...new Set(input.tags.map((value) => value.trim()).filter(Boolean))].sort()
    : undefined;
  return {
    videoId,
    channelId,
    title,
    description: input.description.trim(),
    publishedAt,
    ...(optional(input.thumbnailUrl)
      ? { thumbnailUrl: optional(input.thumbnailUrl) }
      : {}),
    durationSeconds: input.durationSeconds,
    ...(input.viewCount === undefined ? {} : { viewCount: input.viewCount }),
    ...(input.likeCount === undefined ? {} : { likeCount: input.likeCount }),
    ...(input.commentCount === undefined
      ? {}
      : { commentCount: input.commentCount }),
    ...(input.privacyStatus === undefined
      ? {}
      : { privacyStatus: input.privacyStatus }),
    ...(tags === undefined ? {} : { tags }),
    ...(optional(input.categoryId)
      ? { categoryId: optional(input.categoryId) }
      : {}),
    ...(optional(input.defaultLanguage)
      ? { defaultLanguage: optional(input.defaultLanguage) }
      : {}),
    ...(optional(input.sourceEtag)
      ? { sourceEtag: optional(input.sourceEtag) }
      : {}),
    availabilityStatus: input.availabilityStatus,
  };
}

export function changedVideoFields(
  current: YouTubeVideo,
  next: YouTubeVideoSnapshot,
): ReadonlyArray<string> {
  return VIDEO_SNAPSHOT_FIELDS.filter(
    (field) => JSON.stringify(current[field]) !== JSON.stringify(next[field]),
  );
}

export function parseYouTubeDurationSeconds(value: string): number | undefined {
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/u.exec(
      value,
    );
  if (!match || !match.slice(1).some((part) => part !== undefined)) {
    return undefined;
  }
  const values = match.slice(1).map((part) => Number(part ?? 0));
  if (values.some((part) => !Number.isFinite(part))) return undefined;
  const [days = 0, hours = 0, minutes = 0, seconds = 0] = values;
  const total = days * 86_400 + hours * 3_600 + minutes * 60 + seconds;
  return Number.isSafeInteger(total) && total >= 0 ? total : undefined;
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
function optionalCount(value: string | undefined): boolean {
  return value === undefined || COUNT_PATTERN.test(value);
}
function canonicalTimestamp(value: string): string | undefined {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) ? parsed.toISOString() : undefined;
}
