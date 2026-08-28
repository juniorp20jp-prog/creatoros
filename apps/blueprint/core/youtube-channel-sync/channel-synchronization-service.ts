import type { Clock, IdGenerator } from "../services";
import type { YouTubeAuthorizationRepository, YouTubeAuthorizationService, YouTubeTokenProtector } from "../youtube-authorization";
import type { YouTubeApiAdapter, YouTubeChannelApiErrorCode } from "./contracts";
import type { ChannelSynchronization, ChannelSynchronizationStatus, YouTubeChannel } from "./models";
import type { ChannelSynchronizationRepository } from "./repositories";
import { changedChannelFields, normalizeChannelSnapshot } from "./validation";

export type ChannelSyncErrorCode = "not-connected" | "channel-not-found" | "channel-private" | "quota-exceeded" | "authorization-failed" | "api-failure" | "persistence-failure" | "channel-conflict";
export type ChannelSyncResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: Readonly<{ code: ChannelSyncErrorCode; message: string }> }>;

export class ChannelSynchronizationService {
  constructor(private readonly channels: ChannelSynchronizationRepository, private readonly authorizations: YouTubeAuthorizationRepository, private readonly authorizationService: YouTubeAuthorizationService, private readonly tokens: YouTubeTokenProtector, private readonly api: YouTubeApiAdapter, private readonly clock: Clock, private readonly ids: IdGenerator) {}

  async synchronize(userId: string): Promise<ChannelSyncResult<Readonly<{ channel: YouTubeChannel; synchronization: ChannelSynchronization }>>> {
    const startedAt = this.clock.now();
    const syncId = this.ids.create("youtube_sync");
    const identity = await this.authorizations.getByUserId(userId);
    if (identity.status === "failure" || identity.value.state !== "connected") return failure("not-connected", "YouTube is not connected.");
    const current = await this.channels.getByUserId(userId);
    let accessToken = await this.resolveAccessToken(userId);
    if (accessToken.status === "failure") return this.failAndRecord(identity.value, syncId, startedAt, accessToken.error.code, accessToken.error.message);
    let response = await this.api.fetchAuthenticatedChannel(accessToken.value, current.status === "success" ? current.value.sourceEtag : undefined);
    if (response.status === "failure" && response.error.code === "unauthorized") {
      const refreshed = await this.authorizationService.refresh(userId);
      if (refreshed.status === "failure") return this.failAndRecord(identity.value, syncId, startedAt, "authorization-failed", "YouTube authorization could not be refreshed.");
      accessToken = await this.resolveAccessToken(userId);
      if (accessToken.status === "failure") return this.failAndRecord(identity.value, syncId, startedAt, accessToken.error.code, accessToken.error.message);
      response = await this.api.fetchAuthenticatedChannel(accessToken.value, current.status === "success" ? current.value.sourceEtag : undefined);
    }
    if (response.status === "failure") return this.failAndRecord(identity.value, syncId, startedAt, mapApiCode(response.error.code), response.error.message);
    const completedAt = this.clock.now();
    if (response.status === "not-modified") {
      if (current.status === "failure") return this.failAndRecord(identity.value, syncId, startedAt, "channel-not-found", "YouTube channel was not found.");
      const synchronization = await this.channels.recordNoChange({ userId, youtubeIdentityId: identity.value.youtubeIdentityId, channelId: current.value.channelId, syncId, startedAt, completedAt });
      if (synchronization.status === "failure") return failure("persistence-failure", synchronization.error.message);
      const channel = await this.channels.getByUserId(userId);
      return channel.status === "success" ? { status: "success", value: { channel: channel.value, synchronization: synchronization.value } } : failure("persistence-failure", channel.error.message);
    }
    const snapshot = normalizeChannelSnapshot(response.value);
    if (!snapshot || snapshot.channelId !== identity.value.channelId) return this.failAndRecord(identity.value, syncId, startedAt, "channel-not-found", "Authorized YouTube channel did not match the connection.");
    if (snapshot.privacyStatus === "private") return this.failAndRecord(identity.value, syncId, startedAt, "channel-private", "Private YouTube channels are not synchronized.");
    const changedFields = changedChannelFields(current.status === "success" ? current.value : undefined, snapshot);
    if (current.status === "success" && changedFields.length === 0) {
      const synchronization = await this.channels.recordNoChange({ userId, youtubeIdentityId: identity.value.youtubeIdentityId, channelId: snapshot.channelId, syncId, startedAt, completedAt });
      if (synchronization.status === "failure") return failure("persistence-failure", synchronization.error.message);
      const channel = await this.channels.getByUserId(userId);
      return channel.status === "success" ? { status: "success", value: { channel: channel.value, synchronization: synchronization.value } } : failure("persistence-failure", channel.error.message);
    }
    const channel: YouTubeChannel = { ...snapshot, userId, youtubeIdentityId: identity.value.youtubeIdentityId, lastSyncedAt: completedAt, syncStatus: "synced", createdAt: current.status === "success" ? current.value.createdAt : completedAt, updatedAt: completedAt };
    const synchronization: ChannelSynchronization = { syncId, userId, youtubeIdentityId: identity.value.youtubeIdentityId, channelId: channel.channelId, outcome: "completed", changedFields, startedAt, completedAt };
    const persisted = await this.channels.complete({ channel, synchronization });
    if (persisted.status === "failure") return failure(persisted.error.code === "channel-conflict" ? "channel-conflict" : "persistence-failure", persisted.error.message);
    return persisted;
  }

  async getChannel(userId: string): Promise<ChannelSyncResult<YouTubeChannel | null>> { const result = await this.channels.getByUserId(userId); return result.status === "success" ? { status: "success", value: result.value } : result.error.code === "not-found" ? { status: "success", value: null } : failure("persistence-failure", result.error.message); }
  async getStatus(userId: string): Promise<ChannelSyncResult<ChannelSynchronizationStatus>> {
    const [channel, latest] = await Promise.all([
      this.channels.getByUserId(userId),
      this.channels.getLatestByUserId(userId),
    ]);
    if (channel.status === "failure" && channel.error.code !== "not-found") return failure("persistence-failure", channel.error.message);
    if (latest.status === "failure" && latest.error.code !== "not-found") return failure("persistence-failure", latest.error.message);
    return {
      status: "success",
      value: {
        channelConnected: channel.status === "success",
        lastSync: latest.status === "success" ? latest.value : null,
      },
    };
  }

  private async resolveAccessToken(userId: string): Promise<ChannelSyncResult<string>> {
    const identity = await this.authorizations.getByUserId(userId);
    if (identity.status === "failure") return failure("not-connected", "YouTube is not connected.");
    let token = await this.authorizations.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
    const expiresSoon = token.status === "success" && (!token.value.accessTokenExpiresAt || token.value.accessTokenExpiresAt <= new Date(Date.parse(this.clock.now()) + 30_000).toISOString());
    if (token.status === "failure" || !token.value.encryptedAccessToken || expiresSoon) {
      const refreshed = await this.authorizationService.refresh(userId);
      if (refreshed.status === "failure") return failure("authorization-failed", "YouTube authorization could not be refreshed.");
      token = await this.authorizations.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
    }
    if (token.status === "failure" || !token.value.encryptedAccessToken) return failure("authorization-failed", "YouTube access token is unavailable.");
    const revealed = await this.tokens.reveal(token.value.encryptedAccessToken);
    return revealed.status === "success" ? { status: "success", value: revealed.value } : failure("authorization-failed", "YouTube access token could not be opened.");
  }

  private async failAndRecord(identity: { userId: string; youtubeIdentityId: string; channelId: string }, syncId: string, startedAt: string, code: ChannelSyncErrorCode, message: string): Promise<ChannelSyncResult<never>> {
    await this.channels.recordFailure({ userId: identity.userId, youtubeIdentityId: identity.youtubeIdentityId, channelId: identity.channelId, syncId, failureCode: code, startedAt, completedAt: this.clock.now() });
    return failure(code, message);
  }
}

function mapApiCode(code: YouTubeChannelApiErrorCode): ChannelSyncErrorCode { if (code === "quota-exceeded" || code === "channel-not-found" || code === "channel-private") return code; if (code === "unauthorized") return "authorization-failed"; return "api-failure"; }
function failure<TValue>(code: ChannelSyncErrorCode, message: string): ChannelSyncResult<TValue> { return { status: "failure", error: { code, message } }; }
