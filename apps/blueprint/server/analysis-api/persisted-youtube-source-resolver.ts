import type {
  ChannelRepository,
  Clock,
  VideoRepository,
  VideoSyncRepository,
  YouTubeAnalyticsRepository,
} from "../../core";
import type {
  AuthenticatedAnalysisPrincipal,
  ConnectedYouTubeSourceResolver,
  ConnectedYouTubeSourceResult,
} from "./contracts";

export class PersistedYouTubeSourceResolver
  implements ConnectedYouTubeSourceResolver
{
  constructor(
    private readonly channels: ChannelRepository,
    private readonly videos: VideoRepository,
    private readonly videoSyncs: VideoSyncRepository,
    private readonly clock: Clock,
    private readonly analytics?: YouTubeAnalyticsRepository,
  ) {}

  async resolve(
    principal: AuthenticatedAnalysisPrincipal,
  ): Promise<ConnectedYouTubeSourceResult> {
    const channel = await this.channels.getByUserId(principal.userId);
    if (channel.status === "failure") {
      return {
        status: "failure",
        error: {
          code:
            channel.error.code === "not-found"
              ? "no-connected-channel"
              : "persistence-failure",
          message:
            channel.error.code === "not-found"
              ? "Connect and synchronize a YouTube channel before running analysis."
              : "The connected YouTube source could not be loaded.",
        },
      };
    }

    const videos = await this.videos.listByUserId(principal.userId, {
      limit: 100,
    });
    if (videos.status === "failure") {
      return {
        status: "failure",
        error: {
          code: "persistence-failure",
          message: "Persisted YouTube videos could not be loaded.",
        },
      };
    }
    if (videos.value.videos.length === 0) {
      return {
        status: "failure",
        error: {
          code: "no-synchronized-videos",
          message: "Synchronize channel videos before running analysis.",
        },
      };
    }

    const [latestSync, analytics] = await Promise.all([
      this.videoSyncs.getLatestByUserId(principal.userId),
      this.analytics?.getVideoProjection(principal.userId, "90d", this.clock.now()),
    ]);
    return {
      status: "success",
      value: {
        creator: principal,
        channel: channel.value,
        videos: videos.value.videos,
        ...(analytics?.status === "success" ? { analytics: analytics.value } : {}),
        collectedAt:
          latestSync.status === "success"
            ? latestSync.value.completedAt
            : this.clock.now(),
        ...(latestSync.status === "success"
          ? {
              synchronizationReference: `video-sync:${latestSync.value.syncId}`,
            }
          : {}),
      },
    };
  }
}
