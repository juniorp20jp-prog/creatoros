import type {
  VideoSynchronization,
  YouTubeVideo,
  YouTubeVideoAvailabilityStatus,
  YouTubeVideoPrivacyStatus,
} from "../../youtube-video-sync";
import type { VideoSyncRow, YouTubeVideoRow } from "./generated/client";

export function mapYouTubeVideoRow(row: YouTubeVideoRow): YouTubeVideo | undefined {
  if (
    !["available", "private", "deleted", "unavailable"].includes(
      row.availabilityStatus,
    ) ||
    (row.privacyStatus !== null &&
      !["public", "unlisted", "private"].includes(row.privacyStatus))
  ) return undefined;
  return {
    videoId: row.videoId,
    userId: row.userId,
    channelId: row.channelId,
    title: row.title,
    description: row.description,
    publishedAt: row.publishedAt.toISOString(),
    ...(row.thumbnailUrl ? { thumbnailUrl: row.thumbnailUrl } : {}),
    durationSeconds: row.durationSeconds,
    ...(row.viewCount !== null ? { viewCount: row.viewCount.toString() } : {}),
    ...(row.likeCount !== null ? { likeCount: row.likeCount.toString() } : {}),
    ...(row.commentCount !== null
      ? { commentCount: row.commentCount.toString() }
      : {}),
    ...(row.privacyStatus
      ? { privacyStatus: row.privacyStatus as YouTubeVideoPrivacyStatus }
      : {}),
    tags: [...row.tags],
    ...(row.categoryId ? { categoryId: row.categoryId } : {}),
    ...(row.defaultLanguage ? { defaultLanguage: row.defaultLanguage } : {}),
    ...(row.sourceEtag ? { sourceEtag: row.sourceEtag } : {}),
    availabilityStatus:
      row.availabilityStatus as YouTubeVideoAvailabilityStatus,
    lastSeenAt: row.lastSeenAt.toISOString(),
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapVideoSyncRow(
  row: VideoSyncRow,
): VideoSynchronization | undefined {
  if (
    !["completed", "no-change", "partial", "failed"].includes(row.outcome) ||
    (row.outcome === "failed") !== Boolean(row.failureCode)
  ) return undefined;
  const counts = [
    row.discoveredCount,
    row.createdCount,
    row.updatedCount,
    row.unchangedCount,
    row.unavailableCount,
    row.coverageCount,
    row.coverageLimit,
  ];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return undefined;
  }
  return {
    syncId: row.syncId,
    userId: row.userId,
    youtubeIdentityId: row.youtubeIdentityId,
    channelId: row.channelId,
    outcome: row.outcome as VideoSynchronization["outcome"],
    counts: {
      discovered: row.discoveredCount,
      created: row.createdCount,
      updated: row.updatedCount,
      unchanged: row.unchangedCount,
      unavailable: row.unavailableCount,
    },
    coverageCount: row.coverageCount,
    coverageLimit: row.coverageLimit,
    truncated: row.truncated,
    ...(row.failureCode ? { failureCode: row.failureCode } : {}),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
  };
}
