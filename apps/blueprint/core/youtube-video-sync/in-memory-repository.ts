import type {
  VideoRepositoryResult,
  VideoSynchronizationRepository,
} from "./repositories";
import type {
  VideoSynchronization,
  VideoSynchronizationStatus,
  YouTubeVideo,
  YouTubeVideoPage,
} from "./models";

function success<TValue>(value: TValue): VideoRepositoryResult<TValue> {
  return { status: "success", value };
}
function notFound<TValue>(): VideoRepositoryResult<TValue> {
  return {
    status: "failure",
    error: { code: "not-found", message: "YouTube video data was not found." },
  };
}
function invalidInput<TValue>(): VideoRepositoryResult<TValue> {
  return {
    status: "failure",
    error: { code: "invalid-input", message: "The YouTube video cursor is invalid." },
  };
}

export class InMemoryVideoSynchronizationRepository
  implements VideoSynchronizationRepository
{
  private readonly videos = new Map<string, YouTubeVideo>();
  private readonly synchronizations: VideoSynchronization[] = [];

  getByIds(
    userId: string,
    videoIds: ReadonlyArray<string>,
  ): Promise<VideoRepositoryResult<ReadonlyArray<YouTubeVideo>>> {
    const ids = new Set(videoIds);
    return Promise.resolve(
      success(
        [...this.videos.values()].filter(
          (video) => video.userId === userId && ids.has(video.videoId),
        ),
      ),
    );
  }

  listByUserId(
    userId: string,
    input: Readonly<{
      limit: number;
      cursor?: Readonly<{ publishedAt: string; videoId: string }>;
    }>,
  ): Promise<VideoRepositoryResult<YouTubeVideoPage>> {
    const ordered = [...this.videos.values()]
      .filter((video) => video.userId === userId)
      .sort(compareVideos);
    const cursorIndex = input.cursor
      ? ordered.findIndex(
          (video) =>
            video.publishedAt === input.cursor?.publishedAt &&
            video.videoId === input.cursor.videoId,
        )
      : -1;
    if (input.cursor && cursorIndex < 0) {
      return Promise.resolve(invalidInput());
    }
    const start = input.cursor ? cursorIndex + 1 : 0;
    const limit = Math.min(Math.max(input.limit, 1), 100);
    const page = ordered.slice(start, start + limit);
    const last = page.at(-1);
    const hasMore = start + page.length < ordered.length;
    return Promise.resolve(
      success({
        videos: page,
        ...(hasMore && last
          ? { nextCursor: { publishedAt: last.publishedAt, videoId: last.videoId } }
          : {}),
      }),
    );
  }

  getLatestByUserId(
    userId: string,
  ): Promise<VideoRepositoryResult<VideoSynchronization>> {
    const value = this.synchronizations
      .filter((sync) => sync.userId === userId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    return Promise.resolve(value ? success(value) : notFound());
  }

  listSyncsByUserId(
    userId: string,
    limit: number,
  ): Promise<VideoRepositoryResult<ReadonlyArray<VideoSynchronization>>> {
    return Promise.resolve(
      success(
        this.synchronizations
          .filter((sync) => sync.userId === userId)
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
          .slice(0, Math.min(Math.max(limit, 1), 100)),
      ),
    );
  }

  complete(
    input: Readonly<{
      created: ReadonlyArray<YouTubeVideo>;
      updated: ReadonlyArray<YouTubeVideo>;
      synchronization: VideoSynchronization;
    }>,
  ): Promise<VideoRepositoryResult<VideoSynchronization>> {
    for (const video of [...input.created, ...input.updated]) {
      this.videos.set(key(video.userId, video.videoId), video);
    }
    this.synchronizations.push(input.synchronization);
    return Promise.resolve(success(input.synchronization));
  }

  recordFailure(
    synchronization: VideoSynchronization,
  ): Promise<VideoRepositoryResult<VideoSynchronization>> {
    this.synchronizations.push(synchronization);
    return Promise.resolve(success(synchronization));
  }

  async getStatus(
    userId: string,
  ): Promise<VideoRepositoryResult<VideoSynchronizationStatus>> {
    const videoCount = [...this.videos.values()].filter(
      (video) => video.userId === userId,
    ).length;
    const latest = await this.getLatestByUserId(userId);
    return success({
      videoCount,
      lastSync: latest.status === "success" ? latest.value : null,
    });
  }
}

function key(userId: string, videoId: string): string {
  return `${userId}:${videoId}`;
}
function compareVideos(left: YouTubeVideo, right: YouTubeVideo): number {
  return (
    right.publishedAt.localeCompare(left.publishedAt) ||
    left.videoId.localeCompare(right.videoId)
  );
}
