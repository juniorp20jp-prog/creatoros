import type { SaveYouTubeAuthorizationInput, YouTubeAuthorizationRepository, YouTubeIdentity, YouTubeRepositoryResult, YouTubeTokenRecord } from "../../youtube-authorization";
import { createYouTubeIdentity, createYouTubeTokenRecord } from "../../youtube-authorization";
import type { AnalysisRunPrismaClient } from "./prisma-client";
import { mapYouTubeIdentityRow, mapYouTubeTokenRow } from "./youtube-authorization-row-mappers";

function success<TValue>(value: TValue): YouTubeRepositoryResult<TValue> { return { status: "success", value }; }
function failure<TValue>(code: "invalid-input" | "not-found" | "duplicate-channel" | "user-not-found" | "persistence-failure", message: string): YouTubeRepositoryResult<TValue> { return { status: "failure", error: { code, message } }; }
function prismaCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }

export class PrismaYouTubeAuthorizationRepository implements YouTubeAuthorizationRepository {
  constructor(private readonly client: AnalysisRunPrismaClient) {}

  async getByUserId(userId: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>> { return this.findIdentity({ userId: userId.trim() }); }
  async getByChannelId(channelId: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>> { return this.findIdentity({ channelId: channelId.trim() }); }

  async getByYouTubeIdentityId(youtubeIdentityId: string): Promise<YouTubeRepositoryResult<YouTubeTokenRecord>> {
    try {
      const row = await this.client.youTubeTokenRow.findUnique({ where: { youtubeIdentityId: youtubeIdentityId.trim() } });
      return row ? success(mapYouTubeTokenRow(row)) : failure("not-found", "YouTube token was not found.");
    } catch { return failure("persistence-failure", "YouTube token persistence failed."); }
  }

  async saveAuthorization(input: SaveYouTubeAuthorizationInput): Promise<YouTubeRepositoryResult<YouTubeIdentity>> {
    const identity = createYouTubeIdentity(input.identity);
    const token = createYouTubeTokenRecord(input.token);
    if (identity.status === "failure") return identity;
    if (token.status === "failure") return token;
    try {
      const row = await this.client.$transaction(async (transaction) => {
        const existing = await transaction.youTubeIdentityRow.findUnique({ where: { userId: identity.value.userId } });
        const saved = existing
          ? await transaction.youTubeIdentityRow.update({ where: { userId: identity.value.userId }, data: { provider: identity.value.provider, providerUserId: identity.value.providerUserId, channelId: identity.value.channelId, channelTitle: identity.value.channelTitle, scopes: [...identity.value.scopes], state: "connected", updatedAt: new Date(identity.value.updatedAt), revokedAt: null } })
          : await transaction.youTubeIdentityRow.create({ data: { ...identity.value, scopes: [...identity.value.scopes], createdAt: new Date(identity.value.createdAt), updatedAt: new Date(identity.value.updatedAt) } });
        await transaction.youTubeTokenRow.upsert({
          where: { youtubeIdentityId: saved.youtubeIdentityId },
          create: { ...token.value, youtubeIdentityId: saved.youtubeIdentityId, createdAt: new Date(token.value.createdAt), updatedAt: new Date(token.value.updatedAt), ...(token.value.accessTokenExpiresAt ? { accessTokenExpiresAt: new Date(token.value.accessTokenExpiresAt) } : {}) },
          update: { encryptedRefreshToken: token.value.encryptedRefreshToken, encryptedAccessToken: token.value.encryptedAccessToken ?? null, accessTokenExpiresAt: token.value.accessTokenExpiresAt ? new Date(token.value.accessTokenExpiresAt) : null, encryptionKeyId: token.value.encryptionKeyId, updatedAt: new Date(token.value.updatedAt) },
        });
        return saved;
      });
      const mapped = mapYouTubeIdentityRow(row);
      return mapped ? success(mapped) : failure("persistence-failure", "Stored YouTube identity is invalid.");
    } catch (error) {
      if (prismaCode(error) === "P2002") return failure("duplicate-channel", "YouTube channel is already connected.");
      if (prismaCode(error) === "P2003") return failure("user-not-found", "CreatorOS user was not found.");
      return failure("persistence-failure", "YouTube authorization persistence failed.");
    }
  }

  async revokeAuthorization(userId: string, revokedAt: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>> {
    try {
      const row = await this.client.$transaction(async (transaction) => {
        const current = await transaction.youTubeIdentityRow.findUnique({ where: { userId: userId.trim() } });
        if (!current) return undefined;
        await transaction.youTubeTokenRow.deleteMany({ where: { youtubeIdentityId: current.youtubeIdentityId } });
        return transaction.youTubeIdentityRow.update({ where: { userId: userId.trim() }, data: { state: "revoked", revokedAt: new Date(revokedAt), updatedAt: new Date(revokedAt) } });
      });
      if (!row) return failure("not-found", "YouTube authorization was not found.");
      const mapped = mapYouTubeIdentityRow(row);
      return mapped ? success(mapped) : failure("persistence-failure", "Stored YouTube identity is invalid.");
    } catch { return failure("persistence-failure", "YouTube authorization persistence failed."); }
  }

  private async findIdentity(where: { userId: string } | { channelId: string }): Promise<YouTubeRepositoryResult<YouTubeIdentity>> {
    try {
      const row = await this.client.youTubeIdentityRow.findUnique({ where });
      if (!row) return failure("not-found", "YouTube authorization was not found.");
      const mapped = mapYouTubeIdentityRow(row);
      return mapped ? success(mapped) : failure("persistence-failure", "Stored YouTube identity is invalid.");
    } catch { return failure("persistence-failure", "YouTube authorization persistence failed."); }
  }
}
