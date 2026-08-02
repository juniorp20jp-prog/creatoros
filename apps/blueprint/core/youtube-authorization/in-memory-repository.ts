import type { YouTubeIdentity, YouTubeTokenRecord } from "./models";
import type { SaveYouTubeAuthorizationInput, YouTubeAuthorizationRepository, YouTubeRepositoryResult } from "./repositories";
import { createYouTubeIdentity, createYouTubeTokenRecord } from "./validation";

export class InMemoryYouTubeAuthorizationRepository implements YouTubeAuthorizationRepository {
  private readonly identities = new Map<string, YouTubeIdentity>();
  private readonly tokens = new Map<string, YouTubeTokenRecord>();

  async getByUserId(userId: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>> { const value = [...this.identities.values()].find((item) => item.userId === userId.trim()); return value ? success(value) : notFound(); }
  async getByChannelId(channelId: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>> { const value = [...this.identities.values()].find((item) => item.channelId === channelId.trim()); return value ? success(value) : notFound(); }
  async getByYouTubeIdentityId(youtubeIdentityId: string): Promise<YouTubeRepositoryResult<YouTubeTokenRecord>> { const value = this.tokens.get(youtubeIdentityId.trim()); return value ? success(value) : notFound(); }

  async saveAuthorization(input: SaveYouTubeAuthorizationInput): Promise<YouTubeRepositoryResult<YouTubeIdentity>> {
    const identity = createYouTubeIdentity(input.identity);
    const token = createYouTubeTokenRecord(input.token);
    if (identity.status === "failure") return identity;
    if (token.status === "failure") return token;
    const channelOwner = [...this.identities.values()].find((item) => item.channelId === identity.value.channelId && item.userId !== identity.value.userId);
    if (channelOwner) return { status: "failure", error: { code: "duplicate-channel", message: "YouTube channel is already connected." } };
    this.identities.set(identity.value.userId, structuredClone(identity.value));
    this.tokens.set(identity.value.youtubeIdentityId, structuredClone(token.value));
    return success(identity.value);
  }

  async revokeAuthorization(userId: string, revokedAt: string): Promise<YouTubeRepositoryResult<YouTubeIdentity>> {
    const current = await this.getByUserId(userId);
    if (current.status === "failure") return current;
    const value = { ...current.value, state: "revoked" as const, revokedAt, updatedAt: revokedAt };
    const validated = createYouTubeIdentity(value);
    if (validated.status === "failure") return validated;
    this.identities.set(value.userId, value);
    this.tokens.delete(value.youtubeIdentityId);
    return success(value);
  }
}

function success<TValue>(value: TValue): YouTubeRepositoryResult<TValue> { return { status: "success", value: structuredClone(value) }; }
function notFound<TValue>(): YouTubeRepositoryResult<TValue> { return { status: "failure", error: { code: "not-found", message: "YouTube authorization was not found." } }; }
