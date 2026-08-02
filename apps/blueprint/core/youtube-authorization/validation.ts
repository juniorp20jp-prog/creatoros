import { YOUTUBE_PROVIDER, type YouTubeIdentity, type YouTubeTokenRecord } from "./models";
import type { YouTubeRepositoryResult } from "./repositories";

export const YOUTUBE_READONLY_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export function normalizeYouTubeScopes(scopes: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))].sort();
}

export function createYouTubeIdentity(input: YouTubeIdentity): YouTubeRepositoryResult<YouTubeIdentity> {
  const value = { ...input, youtubeIdentityId: input.youtubeIdentityId.trim(), userId: input.userId.trim(), providerUserId: input.providerUserId.trim(), channelId: input.channelId.trim(), channelTitle: input.channelTitle.trim(), scopes: normalizeYouTubeScopes(input.scopes) };
  if (!value.youtubeIdentityId || !value.userId || !value.providerUserId || !value.channelId || !value.channelTitle) return invalid("YouTube identity fields are required.");
  if (value.provider !== YOUTUBE_PROVIDER || !value.scopes.includes(YOUTUBE_READONLY_SCOPE)) return invalid("YouTube provider and required scope are invalid.");
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt) || value.updatedAt < value.createdAt || (value.revokedAt !== undefined && !isTimestamp(value.revokedAt))) return invalid("YouTube identity timestamps are invalid.");
  if ((value.state === "revoked") !== Boolean(value.revokedAt)) return invalid("YouTube revocation state is inconsistent.");
  return { status: "success", value };
}

export function createYouTubeTokenRecord(input: YouTubeTokenRecord): YouTubeRepositoryResult<YouTubeTokenRecord> {
  const value = { ...input, tokenId: input.tokenId.trim(), youtubeIdentityId: input.youtubeIdentityId.trim(), encryptionKeyId: input.encryptionKeyId.trim() };
  if (!value.tokenId || !value.youtubeIdentityId || !value.encryptedRefreshToken || !value.encryptionKeyId) return invalid("Encrypted YouTube token fields are required.");
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt) || value.updatedAt < value.createdAt || (value.accessTokenExpiresAt !== undefined && !isTimestamp(value.accessTokenExpiresAt))) return invalid("YouTube token timestamps are invalid.");
  return { status: "success", value };
}

function isTimestamp(value: string): boolean { const parsed = new Date(value); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value; }
function invalid<TValue>(message: string): YouTubeRepositoryResult<TValue> { return { status: "failure", error: { code: "invalid-input", message } }; }
