import type { Clock, IdGenerator } from "../services";
import type { YouTubeAuthorizationService } from "../youtube-authorization";
import type { ChannelRepository } from "../youtube-channel-sync";
import type { VideoRepository } from "../youtube-video-sync";
import type { YouTubeAnalyticsAdapter } from "./contracts";
import type { YouTubeAnalyticsBatch, YouTubeAnalyticsCapability, YouTubeAnalyticsPeriod } from "./models";
import { YOUTUBE_ANALYTICS_METRICS, YOUTUBE_ANALYTICS_READONLY_SCOPE } from "./models";
import { periodDates } from "./projection";
import type { YouTubeAnalyticsRepository } from "./repositories";

export type YouTubeAnalyticsServiceResult<T> =
  | Readonly<{ status: "success"; value: T }>
  | Readonly<{ status: "failure"; error: Readonly<{ code: "not-connected" | "not-authorized" | "invalid-period" | "collection-in-progress" | "provider-failure" | "persistence-failure"; message: string }> }>;

export class YouTubeAnalyticsCollectionService {
  private readonly activeUsers = new Set<string>();

  constructor(private readonly authorization: YouTubeAuthorizationService, private readonly channels: ChannelRepository, private readonly videos: VideoRepository, private readonly repository: YouTubeAnalyticsRepository, private readonly adapter: YouTubeAnalyticsAdapter, private readonly clock: Clock, private readonly ids: IdGenerator) {}

  async status(userId: string): Promise<YouTubeAnalyticsServiceResult<YouTubeAnalyticsCapability>> {
    const youtube = await this.authorization.getStatus(userId);
    if (youtube.status === "failure" || !youtube.value.connected) return failure("not-connected", "YouTube is not connected.");
    const stored = await this.repository.getCapability(userId);
    if (stored.status === "success") return { status: "success", value: stored.value };
    const authorized = youtube.value.scopes.includes(YOUTUBE_ANALYTICS_READONLY_SCOPE);
    const authorizationDate = youtube.value.updatedAt ?? youtube.value.connectedAt;
    return { status: "success", value: { userId, state: authorized ? "authorized" : "not-authorized", ...(authorized && authorizationDate ? { authorizedAt: authorizationDate } : {}), updatedAt: authorizationDate ?? this.clock.now() } };
  }

  async recordCapability(userId: string, state: YouTubeAnalyticsCapability["state"]): Promise<YouTubeAnalyticsServiceResult<YouTubeAnalyticsCapability>> {
    const current = await this.repository.getCapability(userId);
    const now = this.clock.now();
    const value: YouTubeAnalyticsCapability = { userId, state, ...(state === "authorized" ? { authorizedAt: current.status === "success" ? current.value.authorizedAt ?? now : now } : {}), ...(current.status === "success" && current.value.lastCollectionAt ? { lastCollectionAt: current.value.lastCollectionAt } : {}), ...(current.status === "success" && current.value.effectiveDataThrough ? { effectiveDataThrough: current.value.effectiveDataThrough } : {}), updatedAt: now };
    const saved = await this.repository.saveCapability(value);
    return saved.status === "success" ? saved : failure("persistence-failure", saved.error.message);
  }

  async collect(userId: string, period: YouTubeAnalyticsPeriod = "90d"): Promise<YouTubeAnalyticsServiceResult<YouTubeAnalyticsBatch>> {
    if (!(["7d", "30d", "90d"] as ReadonlyArray<string>).includes(period)) return failure("invalid-period", "YouTube Analytics period is invalid.");
    const owner = userId.trim();
    if (this.activeUsers.has(owner)) return failure("collection-in-progress", "A YouTube Analytics collection is already in progress.");
    this.activeUsers.add(owner);
    try {
      return await this.collectExclusive(owner, period);
    } finally {
      this.activeUsers.delete(owner);
    }
  }

  private async collectExclusive(userId: string, period: YouTubeAnalyticsPeriod): Promise<YouTubeAnalyticsServiceResult<YouTubeAnalyticsBatch>> {
    const connection = await this.authorization.getStatus(userId);
    if (connection.status === "failure" || !connection.value.connected) return failure("not-connected", "YouTube is not connected.");
    if (!connection.value.scopes.includes(YOUTUBE_ANALYTICS_READONLY_SCOPE)) return failure("not-authorized", "YouTube Analytics is not authorized.");
    const [channel, page, accessToken] = await Promise.all([this.channels.getByUserId(userId), this.videos.listByUserId(userId, { limit: 50 }), this.authorization.getAccessToken(userId)]);
    if (channel.status === "failure" || page.status === "failure") return failure("persistence-failure", "Owned YouTube data could not be loaded.");
    if (accessToken.status === "failure") return failure("not-authorized", "YouTube Analytics authorization must be renewed.");
    const collectedAt = this.clock.now();
    const range = periodDates(period, collectedAt);
    const provider = await this.adapter.collect({ accessToken: accessToken.value, channelId: channel.value.channelId, videoIds: page.value.videos.slice(0, 50).map((video) => video.videoId), startDate: range.requestedStartDate, endDate: range.requestedEndDate, collectedAt });
    if (provider.status === "failure") {
      const failed: YouTubeAnalyticsBatch = { batchId: this.ids.create("youtube_analytics_batch"), userId, channelId: channel.value.channelId, ...range, collectedAt, outcome: "failed", availableFields: [], missingFields: [...YOUTUBE_ANALYTICS_METRICS], channelRowCount: 0, videoRowCount: 0, videoCoverageCount: 0, videoCoverageLimit: 50 };
      const audit = await this.repository.persist({ batch: failed, channel: [], videos: [] });
      if (audit.status === "failure") return failure("persistence-failure", audit.error.message);
      const capability = await this.recordCapability(userId, provider.error.code === "authorization" ? "revoked" : "temporarily-unavailable");
      if (capability.status === "failure") return capability;
      return failure(provider.error.code === "authorization" ? "not-authorized" : "provider-failure", provider.error.message);
    }
    const batchId = this.ids.create("youtube_analytics_batch");
    const outcome = provider.value.channel.length === 0 && provider.value.videos.length === 0 ? "no-data" : provider.value.partial ? "partial" : "completed";
    const batch: YouTubeAnalyticsBatch = { batchId, userId, channelId: channel.value.channelId, ...range, ...(provider.value.effectiveDataThrough ? { effectiveDataThrough: provider.value.effectiveDataThrough } : {}), collectedAt, outcome, availableFields: [...provider.value.availableFields], missingFields: [...provider.value.missingFields], channelRowCount: provider.value.channel.length, videoRowCount: provider.value.videos.length, videoCoverageCount: new Set(provider.value.videos.map((row) => row.videoId)).size, videoCoverageLimit: 50 };
    const persisted = await this.repository.persist({ batch, channel: provider.value.channel.map((row) => ({ ...row, batchId })), videos: provider.value.videos.map((row) => ({ ...row, batchId })) });
    if (persisted.status === "failure") return failure("persistence-failure", persisted.error.message);
    const previous = await this.repository.getCapability(userId);
    const capability: YouTubeAnalyticsCapability = { userId, state: "authorized", authorizedAt: previous.status === "success" ? previous.value.authorizedAt ?? collectedAt : collectedAt, lastCollectionAt: collectedAt, ...(provider.value.effectiveDataThrough ? { effectiveDataThrough: provider.value.effectiveDataThrough } : {}), updatedAt: collectedAt };
    if ((await this.repository.saveCapability(capability)).status === "failure") return failure("persistence-failure", "YouTube Analytics capability could not be saved.");
    return { status: "success", value: batch };
  }

  channel(userId: string, period: YouTubeAnalyticsPeriod) { return this.repository.getChannelProjection(userId, period, this.clock.now()); }
  video(userId: string, period: YouTubeAnalyticsPeriod) { return this.repository.getVideoProjection(userId, period, this.clock.now()); }
}

function failure<T>(code: "not-connected" | "not-authorized" | "invalid-period" | "collection-in-progress" | "provider-failure" | "persistence-failure", message: string): YouTubeAnalyticsServiceResult<T> { return { status: "failure", error: { code, message } }; }
