import type { YouTubeIdentity, YouTubeTokenRecord } from "../../youtube-authorization";
import type { YouTubeIdentityRow, YouTubeTokenRow } from "./generated/client";

export function mapYouTubeIdentityRow(row: YouTubeIdentityRow): YouTubeIdentity | undefined {
  if (row.provider !== "youtube" || (row.state !== "connected" && row.state !== "revoked")) return undefined;
  if ((row.state === "revoked") !== Boolean(row.revokedAt)) return undefined;
  return {
    youtubeIdentityId: row.youtubeIdentityId,
    userId: row.userId,
    provider: "youtube",
    providerUserId: row.providerUserId,
    channelId: row.channelId,
    channelTitle: row.channelTitle,
    scopes: [...row.scopes],
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {}),
  };
}

export function mapYouTubeTokenRow(row: YouTubeTokenRow): YouTubeTokenRecord {
  return {
    tokenId: row.tokenId,
    youtubeIdentityId: row.youtubeIdentityId,
    encryptedRefreshToken: row.encryptedRefreshToken,
    ...(row.encryptedAccessToken ? { encryptedAccessToken: row.encryptedAccessToken } : {}),
    ...(row.accessTokenExpiresAt ? { accessTokenExpiresAt: row.accessTokenExpiresAt.toISOString() } : {}),
    encryptionKeyId: row.encryptionKeyId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
