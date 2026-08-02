import type { YouTubeIdentity, YouTubeTokenRecord } from "./models";

export type YouTubeRepositoryErrorCode = "invalid-input" | "not-found" | "duplicate-channel" | "user-not-found" | "persistence-failure";
export type YouTubeRepositoryError = Readonly<{ code: YouTubeRepositoryErrorCode; message: string }>;
export type YouTubeRepositoryResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: YouTubeRepositoryError }>;

export type SaveYouTubeAuthorizationInput = Readonly<{
  identity: YouTubeIdentity;
  token: YouTubeTokenRecord;
}>;

export interface YouTubeIdentityRepository {
  getByUserId(userId: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>>;
  getByChannelId(channelId: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>>;
}

export interface YouTubeTokenRepository {
  getByYouTubeIdentityId(youtubeIdentityId: string): Promise<YouTubeRepositoryResult<YouTubeTokenRecord>>;
}

/** Atomic persistence boundary used by connect, reconnect and disconnect. */
export interface YouTubeAuthorizationRepository extends YouTubeIdentityRepository, YouTubeTokenRepository {
  saveAuthorization(input: SaveYouTubeAuthorizationInput): Promise<YouTubeRepositoryResult<YouTubeIdentity>>;
  revokeAuthorization(userId: string, revokedAt: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>>;
}
