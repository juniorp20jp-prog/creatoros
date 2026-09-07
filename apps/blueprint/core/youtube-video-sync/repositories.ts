import type {
  VideoSynchronization,
  VideoSynchronizationStatus,
  YouTubeVideo,
  YouTubeVideoPage,
} from "./models";

export type VideoRepositoryErrorCode =
  | "invalid-input"
  | "not-found"
  | "persistence-failure";
export type VideoRepositoryResult<TValue> =
  | Readonly<{ status: "success"; value: TValue }>
  | Readonly<{
      status: "failure";
      error: Readonly<{ code: VideoRepositoryErrorCode; message: string }>;
    }>;

export interface VideoRepository {
  getByIds(
    userId: string,
    videoIds: ReadonlyArray<string>,
  ): Promise<VideoRepositoryResult<ReadonlyArray<YouTubeVideo>>>;
  listByUserId(
    userId: string,
    input: Readonly<{
      limit: number;
      cursor?: Readonly<{ publishedAt: string; videoId: string }>;
    }>,
  ): Promise<VideoRepositoryResult<YouTubeVideoPage>>;
}

export interface VideoSyncRepository {
  getLatestByUserId(
    userId: string,
  ): Promise<VideoRepositoryResult<VideoSynchronization>>;
  listSyncsByUserId(
    userId: string,
    limit: number,
  ): Promise<VideoRepositoryResult<ReadonlyArray<VideoSynchronization>>>;
}

export interface VideoSynchronizationRepository
  extends VideoRepository,
    VideoSyncRepository {
  complete(input: Readonly<{
    created: ReadonlyArray<YouTubeVideo>;
    updated: ReadonlyArray<YouTubeVideo>;
    synchronization: VideoSynchronization;
  }>): Promise<VideoRepositoryResult<VideoSynchronization>>;
  recordFailure(
    synchronization: VideoSynchronization,
  ): Promise<VideoRepositoryResult<VideoSynchronization>>;
  getStatus(
    userId: string,
  ): Promise<VideoRepositoryResult<VideoSynchronizationStatus>>;
}
