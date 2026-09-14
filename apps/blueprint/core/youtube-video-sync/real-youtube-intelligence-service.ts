import type {
  YouTubeIntelligenceInput,
  YouTubeIntelligenceOutput,
} from "../engines/youtube-intelligence";
import type { EngineExecutionResult } from "../types";
import type { Clock } from "../services";
import type { ChannelRepository } from "../youtube-channel-sync";
import { mapPersistedYouTubeDataToIntelligenceInput } from "./intelligence-input";
import type { VideoSynchronizationRepository } from "./repositories";
import type { VideoSynchronization } from "./models";
import type { YouTubeAnalyticsRepository } from "../youtube-analytics";

export type RealYouTubeIntelligenceResult =
  | Readonly<{
      status: "success";
      value: Readonly<{
        output: YouTubeIntelligenceOutput;
        excludedVideoCount: number;
        synchronization: VideoSynchronization | null;
      }>;
    }>
  | Readonly<{
      status: "failure";
      error: Readonly<{
        code:
          | "channel-not-found"
          | "insufficient-data"
          | "engine-failed"
          | "persistence-failure";
        message: string;
      }>;
    }>;

type YouTubeIntelligenceExecutor = (
  input: YouTubeIntelligenceInput,
  options: Readonly<{ correlationId: string }>,
) => Promise<EngineExecutionResult<YouTubeIntelligenceOutput>>;

export class RealYouTubeIntelligenceService {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly videos: VideoSynchronizationRepository,
    private readonly execute: YouTubeIntelligenceExecutor,
    private readonly clock: Clock,
    private readonly analytics?: YouTubeAnalyticsRepository,
  ) {}

  async analyze(userId: string): Promise<RealYouTubeIntelligenceResult> {
    const [channel, status] = await Promise.all([
      this.channels.getByUserId(userId),
      this.videos.getStatus(userId),
    ]);
    if (channel.status === "failure") {
      return channel.error.code === "not-found"
        ? failure("channel-not-found", "YouTube channel was not found.")
        : failure("persistence-failure", channel.error.message);
    }
    if (status.status === "failure") {
      return failure("persistence-failure", "YouTube video data could not be loaded.");
    }
    const page = await this.videos.listByUserId(userId, {
      limit: Math.min(status.value.lastSync?.coverageLimit ?? 50, 50),
    });
    if (page.status === "failure") {
      return failure("persistence-failure", "YouTube video data could not be loaded.");
    }
    const analytics = await this.analytics?.getVideoProjection(userId, "90d", this.clock.now());
    const mapped = mapPersistedYouTubeDataToIntelligenceInput(
      channel.value,
      page.value.videos,
      this.clock.now(),
      analytics?.status === "success" ? analytics.value : [],
    );
    if (mapped.status === "failure") {
      return failure("insufficient-data", mapped.error.message);
    }
    const result = await this.execute(mapped.value.input, {
      correlationId: `youtube-real-${userId}`,
    });
    if (result.status === "failed") {
      return failure("engine-failed", "YouTube intelligence could not be completed.");
    }
    return {
      status: "success",
      value: {
        output: result.output,
        excludedVideoCount: mapped.value.excludedVideoCount,
        synchronization: status.value.lastSync,
      },
    };
  }
}

function failure(
  code: "channel-not-found" | "insufficient-data" | "engine-failed" | "persistence-failure",
  message: string,
): RealYouTubeIntelligenceResult {
  return { status: "failure", error: { code, message } };
}
