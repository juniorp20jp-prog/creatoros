import type { Clock, IdGenerator } from "../services";
import type { YouTubeAuthorizationProvider, YouTubeTokenProtector } from "./contracts";
import { YOUTUBE_PROVIDER, type YouTubeConnectionStatus, type VerifiedYouTubeGrant, type YouTubeTokenRecord } from "./models";
import type { YouTubeAuthorizationRepository } from "./repositories";
import { normalizeYouTubeScopes, YOUTUBE_READONLY_SCOPE } from "./validation";

export type YouTubeAuthorizationErrorCode = "invalid-grant" | "not-connected" | "channel-conflict" | "persistence-failure" | "token-protection-failed" | "refresh-failed" | "revocation-failed";
export type YouTubeAuthorizationResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: Readonly<{ code: YouTubeAuthorizationErrorCode; message: string }> }>;

export class YouTubeAuthorizationService {
  constructor(private readonly repository: YouTubeAuthorizationRepository, private readonly tokens: YouTubeTokenProtector, private readonly provider: YouTubeAuthorizationProvider, private readonly clock: Clock, private readonly ids: IdGenerator) {}

  async connect(userId: string, grant: VerifiedYouTubeGrant): Promise<YouTubeAuthorizationResult<YouTubeConnectionStatus>> {
    const normalizedUserId = userId.trim();
    const current = await this.repository.getByUserId(normalizedUserId);
    const scopes = normalizeYouTubeScopes([
      ...(current.status === "success" ? current.value.scopes : []),
      ...grant.scopes,
    ]);
    if (!normalizedUserId || !grant.providerUserId.trim() || !grant.channelId.trim() || !grant.channelTitle.trim() || !scopes.includes(YOUTUBE_READONLY_SCOPE)) return failure("invalid-grant", "YouTube authorization grant is invalid.");
    if (
      current.status === "success" &&
      (current.value.providerUserId !== grant.providerUserId.trim() ||
        current.value.channelId !== grant.channelId.trim())
    ) return failure("channel-conflict", "The Analytics grant does not match the connected YouTube identity.");
    const currentToken = current.status === "success" ? await this.repository.getByYouTubeIdentityId(current.value.youtubeIdentityId) : undefined;
    const refreshToken = grant.refreshToken?.trim();
    let encryptedRefreshToken: string;
    if (refreshToken) {
      const protectedToken = await this.tokens.protect(refreshToken);
      if (protectedToken.status === "failure") return failure("token-protection-failed", protectedToken.error.message);
      encryptedRefreshToken = protectedToken.value;
    } else if (currentToken?.status === "success") encryptedRefreshToken = currentToken.value.encryptedRefreshToken;
    else return failure("invalid-grant", "A refresh token is required for the first YouTube connection.");
    const encryptedAccessToken = grant.accessToken ? await this.tokens.protect(grant.accessToken) : undefined;
    if (encryptedAccessToken?.status === "failure") return failure("token-protection-failed", encryptedAccessToken.error.message);
    const now = this.clock.now();
    const youtubeIdentityId = current.status === "success" ? current.value.youtubeIdentityId : this.ids.create("youtube_identity");
    const tokenId = currentToken?.status === "success" ? currentToken.value.tokenId : this.ids.create("youtube_token");
    const token: YouTubeTokenRecord = { tokenId, youtubeIdentityId, encryptedRefreshToken, ...(encryptedAccessToken?.status === "success" ? { encryptedAccessToken: encryptedAccessToken.value } : {}), ...(grant.accessTokenExpiresAt ? { accessTokenExpiresAt: grant.accessTokenExpiresAt } : {}), encryptionKeyId: this.tokens.activeKeyId, createdAt: currentToken?.status === "success" ? currentToken.value.createdAt : now, updatedAt: now };
    const saved = await this.repository.saveAuthorization({ identity: { youtubeIdentityId, userId: normalizedUserId, provider: YOUTUBE_PROVIDER, providerUserId: grant.providerUserId, channelId: grant.channelId, channelTitle: grant.channelTitle, scopes, state: "connected", createdAt: current.status === "success" ? current.value.createdAt : now, updatedAt: now }, token });
    if (saved.status === "failure") return failure(saved.error.code === "duplicate-channel" ? "channel-conflict" : "persistence-failure", saved.error.message);
    return { status: "success", value: connectionStatus(saved.value) };
  }

  async getStatus(userId: string): Promise<YouTubeAuthorizationResult<YouTubeConnectionStatus>> {
    const result = await this.repository.getByUserId(userId);
    if (result.status === "failure") return result.error.code === "not-found" ? { status: "success", value: { connected: false, scopes: [] } } : failure("persistence-failure", result.error.message);
    return { status: "success", value: connectionStatus(result.value) };
  }

  async refresh(userId: string): Promise<YouTubeAuthorizationResult<YouTubeConnectionStatus>> {
    const identity = await this.repository.getByUserId(userId);
    if (identity.status === "failure" || identity.value.state !== "connected") return failure("not-connected", "YouTube is not connected.");
    const stored = await this.repository.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
    if (stored.status === "failure") return failure("persistence-failure", stored.error.message);
    const revealed = await this.tokens.reveal(stored.value.encryptedRefreshToken);
    if (revealed.status === "failure") return failure("token-protection-failed", revealed.error.message);
    const refreshed = await this.provider.refresh(revealed.value);
    if (refreshed.status === "failure") return failure("refresh-failed", refreshed.error.message);
    return this.connect(userId, { providerUserId: identity.value.providerUserId, channelId: identity.value.channelId, channelTitle: identity.value.channelTitle, scopes: refreshed.value.scopes ?? identity.value.scopes, refreshToken: refreshed.value.refreshToken ?? revealed.value, accessToken: refreshed.value.accessToken, ...(refreshed.value.accessTokenExpiresAt ? { accessTokenExpiresAt: refreshed.value.accessTokenExpiresAt } : {}) });
  }

  async getAccessToken(userId: string): Promise<YouTubeAuthorizationResult<string>> {
    const identity = await this.repository.getByUserId(userId);
    if (identity.status === "failure" || identity.value.state !== "connected") {
      return failure("not-connected", "YouTube is not connected.");
    }
    let stored = await this.repository.getByYouTubeIdentityId(
      identity.value.youtubeIdentityId,
    );
    const expiresSoon =
      stored.status === "success" &&
      (!stored.value.accessTokenExpiresAt ||
        stored.value.accessTokenExpiresAt <=
          new Date(Date.parse(this.clock.now()) + 30_000).toISOString());
    if (
      stored.status === "failure" ||
      !stored.value.encryptedAccessToken ||
      expiresSoon
    ) {
      const refreshed = await this.refresh(userId);
      if (refreshed.status === "failure") {
        return failure(
          "refresh-failed",
          "YouTube authorization could not be refreshed.",
        );
      }
      stored = await this.repository.getByYouTubeIdentityId(
        identity.value.youtubeIdentityId,
      );
    }
    if (stored.status === "failure" || !stored.value.encryptedAccessToken) {
      return failure("refresh-failed", "YouTube access token is unavailable.");
    }
    const revealed = await this.tokens.reveal(stored.value.encryptedAccessToken);
    return revealed.status === "success"
      ? { status: "success", value: revealed.value }
      : failure("token-protection-failed", revealed.error.message);
  }

  async disconnect(userId: string): Promise<YouTubeAuthorizationResult<YouTubeConnectionStatus>> {
    const identity = await this.repository.getByUserId(userId);
    if (identity.status === "failure") return identity.error.code === "not-found" ? { status: "success", value: { connected: false, scopes: [] } } : failure("persistence-failure", identity.error.message);
    if (identity.value.state === "revoked") return { status: "success", value: connectionStatus(identity.value) };
    const stored = await this.repository.getByYouTubeIdentityId(identity.value.youtubeIdentityId);
    if (stored.status === "failure") return failure("persistence-failure", stored.error.message);
    const revealed = await this.tokens.reveal(stored.value.encryptedRefreshToken);
    if (revealed.status === "failure") return failure("token-protection-failed", revealed.error.message);
    const revoked = await this.provider.revoke(revealed.value);
    if (revoked.status === "failure") return failure("revocation-failed", revoked.error.message);
    const persisted = await this.repository.revokeAuthorization(userId, this.clock.now());
    if (persisted.status === "failure") return failure("persistence-failure", persisted.error.message);
    return { status: "success", value: connectionStatus(persisted.value) };
  }
}

function connectionStatus(identity: { state: "connected" | "revoked"; channelId: string; channelTitle: string; scopes: ReadonlyArray<string>; createdAt: string; updatedAt: string }): YouTubeConnectionStatus { return identity.state === "connected" ? { connected: true, channelId: identity.channelId, channelTitle: identity.channelTitle, scopes: [...identity.scopes], connectedAt: identity.createdAt, updatedAt: identity.updatedAt } : { connected: false, scopes: [] }; }
function failure<TValue>(code: YouTubeAuthorizationErrorCode, message: string): YouTubeAuthorizationResult<TValue> { return { status: "failure", error: { code, message } }; }
