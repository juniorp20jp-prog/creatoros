import type { Clock, IdGenerator } from "../services";
import type {
  YouTubeAuthorizationRepository,
  YouTubeAuthorizationService,
} from "../youtube-authorization";
import type {
  YouTubeVideoApiAdapter,
  YouTubeVideoApiErrorCode,
} from "./contracts";
import {
  YOUTUBE_VIDEO_SYNC_COVERAGE_LIMIT,
  type VideoSynchronization,
  type VideoSynchronizationStatus,
  type YouTubeVideo,
  type YouTubeVideoPage,
} from "./models";
import type { VideoSynchronizationRepository } from "./repositories";
import { changedVideoFields, normalizeVideoSnapshot } from "./validation";

export type VideoSyncErrorCode =
  | "not-connected"
  | "channel-not-found"
  | "quota-exceeded"
  | "authorization-failed"
  | "api-failure"
  | "invalid-input"
  | "invalid-provider-data"
  | "persistence-failure";
export type VideoSyncResult<TValue> =
  | Readonly<{ status: "success"; value: TValue }>
  | Readonly<{
      status: "failure";
      error: Readonly<{ code: VideoSyncErrorCode; message: string }>;
    }>;

export class VideoSynchronizationService {
  constructor(
    private readonly videos: VideoSynchronizationRepository,
    private readonly authorizations: YouTubeAuthorizationRepository,
    private readonly authorizationService: YouTubeAuthorizationService,
    private readonly api: YouTubeVideoApiAdapter,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly coverageLimit = YOUTUBE_VIDEO_SYNC_COVERAGE_LIMIT,
  ) {}

  async synchronize(
    userId: string,
  ): Promise<VideoSyncResult<{
    videos: ReadonlyArray<YouTubeVideo>;
    synchronization: VideoSynchronization;
  }>> {
    const startedAt = this.clock.now();
    const syncId = this.ids.create("youtube_video_sync");
    const identity = await this.authorizations.getByUserId(userId);
    if (identity.status === "failure" || identity.value.state !== "connected") {
      return failure("not-connected", "YouTube is not connected.");
    }

    let access = await this.authorizationService.getAccessToken(userId);
    if (access.status === "failure") {
      return this.failAndRecord(identity.value, syncId, startedAt, "authorization-failed", "YouTube authorization is unavailable.");
    }
    let response = await this.api.fetchUploadVideoWindow(access.value, {
      limit: this.coverageLimit,
    });
    if (response.status === "failure" && response.error.code === "unauthorized") {
      const refreshed = await this.authorizationService.refresh(userId);
      if (refreshed.status === "failure") {
        return this.failAndRecord(identity.value, syncId, startedAt, "authorization-failed", "YouTube authorization could not be refreshed.");
      }
      access = await this.authorizationService.getAccessToken(userId);
      if (access.status === "failure") {
        return this.failAndRecord(identity.value, syncId, startedAt, "authorization-failed", "YouTube authorization is unavailable.");
      }
      response = await this.api.fetchUploadVideoWindow(access.value, {
        limit: this.coverageLimit,
      });
    }
    if (response.status === "failure") {
      return this.failAndRecord(identity.value, syncId, startedAt, mapApiCode(response.error.code), response.error.message);
    }
    if (response.value.channelId !== identity.value.channelId) {
      return this.failAndRecord(identity.value, syncId, startedAt, "channel-not-found", "Authorized YouTube channel did not match the connection.");
    }

    const ids = response.value.videos.map((video) => video.videoId);
    if (new Set(ids).size !== ids.length) {
      return this.failAndRecord(identity.value, syncId, startedAt, "invalid-provider-data", "YouTube returned duplicate video identifiers.");
    }
    const normalized = response.value.videos.map(normalizeVideoSnapshot);
    if (
      normalized.some((video) => video === undefined) ||
      normalized.some((video) => video?.channelId !== identity.value.channelId)
    ) {
      return this.failAndRecord(identity.value, syncId, startedAt, "invalid-provider-data", "YouTube returned invalid video data.");
    }
    const snapshots = normalized.filter(
      (video): video is NonNullable<typeof video> => video !== undefined,
    );
    const existing = await this.videos.getByIds(userId, ids);
    if (existing.status === "failure") {
      return this.failAndRecord(identity.value, syncId, startedAt, "persistence-failure", existing.error.message);
    }

    const byId = new Map(existing.value.map((video) => [video.videoId, video]));
    const completedAt = this.clock.now();
    const created: YouTubeVideo[] = [];
    const updated: YouTubeVideo[] = [];
    let unchanged = 0;
    for (const snapshot of snapshots) {
      const current = byId.get(snapshot.videoId);
      if (!current) {
        created.push({
          ...snapshot,
          userId,
          lastSeenAt: completedAt,
          lastSyncedAt: completedAt,
          createdAt: completedAt,
          updatedAt: completedAt,
        });
      } else if (changedVideoFields(current, snapshot).length > 0) {
        updated.push({
          ...snapshot,
          userId,
          lastSeenAt: completedAt,
          lastSyncedAt: completedAt,
          createdAt: current.createdAt,
          updatedAt: completedAt,
        });
      } else {
        unchanged += 1;
      }
    }

    const counts = {
      discovered: response.value.discovered,
      created: created.length,
      updated: updated.length,
      unchanged,
      unavailable: response.value.unavailable,
    };
    const outcome =
      created.length === 0 &&
      updated.length === 0 &&
      response.value.unavailable === 0
        ? "no-change"
        : response.value.unavailable > 0
          ? "partial"
          : "completed";
    const synchronization: VideoSynchronization = {
      syncId,
      userId,
      youtubeIdentityId: identity.value.youtubeIdentityId,
      channelId: identity.value.channelId,
      outcome,
      counts,
      coverageCount: response.value.coverageCount,
      coverageLimit: response.value.coverageLimit,
      truncated: response.value.truncated,
      startedAt,
      completedAt,
    };
    const persisted = await this.videos.complete({ created, updated, observed: snapshots, synchronization });
    if (persisted.status === "failure") {
      return failure("persistence-failure", persisted.error.message);
    }
    const page = await this.videos.listByUserId(userId, {
      limit: this.coverageLimit,
    });
    return page.status === "success"
      ? { status: "success", value: { videos: page.value.videos, synchronization: persisted.value } }
      : failure("persistence-failure", page.error.message);
  }

  async list(
    userId: string,
    input: Readonly<{
      limit: number;
      cursor?: Readonly<{ publishedAt: string; videoId: string }>;
    }>,
  ): Promise<VideoSyncResult<YouTubeVideoPage>> {
    const result = await this.videos.listByUserId(userId, input);
    return result.status === "success"
      ? result
      : failure(
          result.error.code === "invalid-input" ? "invalid-input" : "persistence-failure",
          result.error.message,
        );
  }

  async getStatus(
    userId: string,
  ): Promise<VideoSyncResult<VideoSynchronizationStatus>> {
    const result = await this.videos.getStatus(userId);
    return result.status === "success"
      ? result
      : failure("persistence-failure", result.error.message);
  }

  private async failAndRecord(
    identity: { userId: string; youtubeIdentityId: string; channelId: string },
    syncId: string,
    startedAt: string,
    code: VideoSyncErrorCode,
    message: string,
  ): Promise<VideoSyncResult<never>> {
    const completedAt = this.clock.now();
    await this.videos.recordFailure({
      syncId,
      userId: identity.userId,
      youtubeIdentityId: identity.youtubeIdentityId,
      channelId: identity.channelId,
      outcome: "failed",
      counts: { discovered: 0, created: 0, updated: 0, unchanged: 0, unavailable: 0 },
      coverageCount: 0,
      coverageLimit: this.coverageLimit,
      truncated: false,
      failureCode: code,
      startedAt,
      completedAt,
    });
    return failure(code, message);
  }
}

function mapApiCode(code: YouTubeVideoApiErrorCode): VideoSyncErrorCode {
  if (code === "quota-exceeded" || code === "channel-not-found") return code;
  if (code === "unauthorized") return "authorization-failed";
  return "api-failure";
}
function failure<TValue>(
  code: VideoSyncErrorCode,
  message: string,
): VideoSyncResult<TValue> {
  return { status: "failure", error: { code, message } };
}
