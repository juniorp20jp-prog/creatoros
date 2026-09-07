import type {
  VideoRepositoryResult,
  VideoSynchronization,
  VideoSynchronizationRepository,
  VideoSynchronizationStatus,
  YouTubeVideo,
  YouTubeVideoPage,
} from "../../youtube-video-sync";
import type { AnalysisRunPrismaClient } from "./prisma-client";
import { mapVideoSyncRow, mapYouTubeVideoRow } from "./youtube-video-row-mappers";

function success<TValue>(value: TValue): VideoRepositoryResult<TValue> {
  return { status: "success", value };
}
function failure<TValue>(
  code: "invalid-input" | "not-found" | "persistence-failure",
  message: string,
): VideoRepositoryResult<TValue> {
  return { status: "failure", error: { code, message } };
}

export class PrismaVideoSynchronizationRepository
  implements VideoSynchronizationRepository
{
  constructor(private readonly client: AnalysisRunPrismaClient) {}

  async getByIds(
    userId: string,
    videoIds: ReadonlyArray<string>,
  ): Promise<VideoRepositoryResult<ReadonlyArray<YouTubeVideo>>> {
    try {
      if (videoIds.length === 0) return success([]);
      const rows = await this.client.youTubeVideoRow.findMany({
        where: { userId: userId.trim(), videoId: { in: [...videoIds] } },
      });
      return mapVideos(rows);
    } catch {
      return failure("persistence-failure", "YouTube video persistence failed.");
    }
  }

  async listByUserId(
    userId: string,
    input: Readonly<{
      limit: number;
      cursor?: Readonly<{ publishedAt: string; videoId: string }>;
    }>,
  ): Promise<VideoRepositoryResult<YouTubeVideoPage>> {
    try {
      const limit = Math.min(Math.max(input.limit, 1), 100);
      if (input.cursor) {
        const publishedAt = new Date(input.cursor.publishedAt);
        if (Number.isNaN(publishedAt.valueOf())) {
          return failure("invalid-input", "The YouTube video cursor is invalid.");
        }
        const cursorRow = await this.client.youTubeVideoRow.findFirst({
          where: {
            userId: userId.trim(),
            videoId: input.cursor.videoId,
            publishedAt,
          },
          select: { videoId: true },
        });
        if (!cursorRow) {
          return failure("invalid-input", "The YouTube video cursor is invalid.");
        }
      }
      const rows = await this.client.youTubeVideoRow.findMany({
        where: { userId: userId.trim() },
        orderBy: [{ publishedAt: "desc" }, { videoId: "asc" }],
        take: limit + 1,
        ...(input.cursor
          ? { cursor: { videoId: input.cursor.videoId }, skip: 1 }
          : {}),
      });
      const hasMore = rows.length > limit;
      const pageRows = rows.slice(0, limit);
      const mapped = mapVideos(pageRows);
      if (mapped.status === "failure") return mapped;
      const last = mapped.value.at(-1);
      return success({
        videos: mapped.value,
        ...(hasMore && last
          ? { nextCursor: { publishedAt: last.publishedAt, videoId: last.videoId } }
          : {}),
      });
    } catch {
      return failure("persistence-failure", "YouTube video persistence failed.");
    }
  }

  async getLatestByUserId(
    userId: string,
  ): Promise<VideoRepositoryResult<VideoSynchronization>> {
    try {
      const row = await this.client.videoSyncRow.findFirst({
        where: { userId: userId.trim() },
        orderBy: [{ startedAt: "desc" }, { syncId: "asc" }],
      });
      return row ? mapSync(row) : failure("not-found", "Video synchronization was not found.");
    } catch {
      return failure("persistence-failure", "Video synchronization persistence failed.");
    }
  }

  async listSyncsByUserId(
    userId: string,
    limit: number,
  ): Promise<VideoRepositoryResult<ReadonlyArray<VideoSynchronization>>> {
    try {
      const rows = await this.client.videoSyncRow.findMany({
        where: { userId: userId.trim() },
        orderBy: [{ startedAt: "desc" }, { syncId: "asc" }],
        take: Math.min(Math.max(limit, 1), 100),
      });
      const values: VideoSynchronization[] = [];
      for (const row of rows) {
        const value = mapVideoSyncRow(row);
        if (!value) {
          return failure("persistence-failure", "Stored video synchronization is invalid.");
        }
        values.push(value);
      }
      return success(values);
    } catch {
      return failure("persistence-failure", "Video synchronization persistence failed.");
    }
  }

  async complete(
    input: Readonly<{
      created: ReadonlyArray<YouTubeVideo>;
      updated: ReadonlyArray<YouTubeVideo>;
      synchronization: VideoSynchronization;
    }>,
  ): Promise<VideoRepositoryResult<VideoSynchronization>> {
    try {
      const row = await this.client.$transaction(async (transaction) => {
        for (const video of input.created) {
          await transaction.youTubeVideoRow.create({ data: videoData(video) });
        }
        for (const video of input.updated) {
          await transaction.youTubeVideoRow.update({
            where: { videoId: video.videoId },
            data: videoData(video),
          });
        }
        return transaction.videoSyncRow.create({
          data: synchronizationData(input.synchronization),
        });
      });
      return mapSync(row);
    } catch {
      return failure("persistence-failure", "Video synchronization persistence failed.");
    }
  }

  async recordFailure(
    synchronization: VideoSynchronization,
  ): Promise<VideoRepositoryResult<VideoSynchronization>> {
    try {
      const row = await this.client.videoSyncRow.create({
        data: synchronizationData(synchronization),
      });
      return mapSync(row);
    } catch {
      return failure("persistence-failure", "Video synchronization persistence failed.");
    }
  }

  async getStatus(
    userId: string,
  ): Promise<VideoRepositoryResult<VideoSynchronizationStatus>> {
    try {
      const [videoCount, latest] = await Promise.all([
        this.client.youTubeVideoRow.count({ where: { userId: userId.trim() } }),
        this.client.videoSyncRow.findFirst({
          where: { userId: userId.trim() },
          orderBy: [{ startedAt: "desc" }, { syncId: "asc" }],
        }),
      ]);
      if (!latest) return success({ videoCount, lastSync: null });
      const sync = mapVideoSyncRow(latest);
      return sync
        ? success({ videoCount, lastSync: sync })
        : failure("persistence-failure", "Stored video synchronization is invalid.");
    } catch {
      return failure("persistence-failure", "Video synchronization persistence failed.");
    }
  }
}

function mapVideos(
  rows: ReadonlyArray<Parameters<typeof mapYouTubeVideoRow>[0]>,
): VideoRepositoryResult<ReadonlyArray<YouTubeVideo>> {
  const values: YouTubeVideo[] = [];
  for (const row of rows) {
    const value = mapYouTubeVideoRow(row);
    if (!value) {
      return failure("persistence-failure", "Stored YouTube video is invalid.");
    }
    values.push(value);
  }
  return success(values);
}
function mapSync(
  row: Parameters<typeof mapVideoSyncRow>[0],
): VideoRepositoryResult<VideoSynchronization> {
  const value = mapVideoSyncRow(row);
  return value
    ? success(value)
    : failure("persistence-failure", "Stored video synchronization is invalid.");
}
function videoData(video: YouTubeVideo) {
  return {
    videoId: video.videoId,
    userId: video.userId,
    channelId: video.channelId,
    title: video.title,
    description: video.description,
    publishedAt: new Date(video.publishedAt),
    thumbnailUrl: video.thumbnailUrl ?? null,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount ?? null,
    likeCount: video.likeCount ?? null,
    commentCount: video.commentCount ?? null,
    privacyStatus: video.privacyStatus ?? null,
    tags: [...(video.tags ?? [])],
    categoryId: video.categoryId ?? null,
    defaultLanguage: video.defaultLanguage ?? null,
    sourceEtag: video.sourceEtag ?? null,
    availabilityStatus: video.availabilityStatus,
    lastSeenAt: new Date(video.lastSeenAt),
    lastSyncedAt: new Date(video.lastSyncedAt),
    createdAt: new Date(video.createdAt),
    updatedAt: new Date(video.updatedAt),
  };
}
function synchronizationData(sync: VideoSynchronization) {
  return {
    syncId: sync.syncId,
    userId: sync.userId,
    youtubeIdentityId: sync.youtubeIdentityId,
    channelId: sync.channelId,
    outcome: sync.outcome,
    discoveredCount: sync.counts.discovered,
    createdCount: sync.counts.created,
    updatedCount: sync.counts.updated,
    unchangedCount: sync.counts.unchanged,
    unavailableCount: sync.counts.unavailable,
    coverageCount: sync.coverageCount,
    coverageLimit: sync.coverageLimit,
    truncated: sync.truncated,
    failureCode: sync.failureCode ?? null,
    startedAt: new Date(sync.startedAt),
    completedAt: new Date(sync.completedAt),
  };
}
