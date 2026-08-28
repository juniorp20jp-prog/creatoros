import type { ChannelRepositoryResult, ChannelSynchronization, ChannelSynchronizationRepository, YouTubeChannel } from "../../youtube-channel-sync";
import type { AnalysisRunPrismaClient } from "./prisma-client";
import { mapChannelSyncRow, mapYouTubeChannelRow } from "./youtube-channel-row-mappers";

function success<TValue>(value: TValue): ChannelRepositoryResult<TValue> { return { status: "success", value }; }
function failure<TValue>(code: "not-found" | "channel-conflict" | "persistence-failure", message: string): ChannelRepositoryResult<TValue> { return { status: "failure", error: { code, message } }; }
function prismaCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }

export class PrismaChannelSynchronizationRepository implements ChannelSynchronizationRepository {
  constructor(private readonly client: AnalysisRunPrismaClient) {}
  async getByUserId(userId: string): Promise<ChannelRepositoryResult<YouTubeChannel>> { return this.findChannel({ userId: userId.trim() }); }
  async getByChannelId(channelId: string): Promise<ChannelRepositoryResult<YouTubeChannel>> { return this.findChannel({ channelId: channelId.trim() }); }
  async getLatestByUserId(userId: string): Promise<ChannelRepositoryResult<ChannelSynchronization>> { try { const row = await this.client.channelSyncRow.findFirst({ where: { userId: userId.trim() }, orderBy: [{ startedAt: "desc" }, { syncId: "asc" }] }); return row ? this.mapSync(row) : failure("not-found", "Channel synchronization was not found."); } catch { return failure("persistence-failure", "Channel synchronization persistence failed."); } }
  async listByUserId(userId: string, limit: number): Promise<ChannelRepositoryResult<ReadonlyArray<ChannelSynchronization>>> { try { const rows = await this.client.channelSyncRow.findMany({ where: { userId: userId.trim() }, orderBy: [{ startedAt: "desc" }, { syncId: "asc" }], take: Math.min(Math.max(limit, 1), 100) }); const values: ChannelSynchronization[] = []; for (const row of rows) { const mapped = mapChannelSyncRow(row); if (!mapped) return failure("persistence-failure", "Stored channel synchronization is invalid."); values.push(mapped); } return success(values); } catch { return failure("persistence-failure", "Channel synchronization persistence failed."); } }

  async complete(input: Readonly<{ channel: YouTubeChannel; synchronization: ChannelSynchronization }>): Promise<ChannelRepositoryResult<Readonly<{ channel: YouTubeChannel; synchronization: ChannelSynchronization }>>> {
    try {
      const result = await this.client.$transaction(async (transaction) => {
        const existing = await transaction.youTubeChannelRow.findUnique({ where: { userId: input.channel.userId } });
        const data = channelData(input.channel);
        const channelRow = existing ? await transaction.youTubeChannelRow.update({ where: { userId: input.channel.userId }, data }) : await transaction.youTubeChannelRow.create({ data: { channelId: input.channel.channelId, userId: input.channel.userId, ...data, createdAt: new Date(input.channel.createdAt) } });
        const syncRow = await transaction.channelSyncRow.create({ data: syncData(input.synchronization) });
        return { channelRow, syncRow };
      });
      const channel = mapYouTubeChannelRow(result.channelRow);
      const synchronization = mapChannelSyncRow(result.syncRow);
      return channel && synchronization ? success({ channel, synchronization }) : failure("persistence-failure", "Stored channel synchronization is invalid.");
    } catch (error) { return prismaCode(error) === "P2002" ? failure("channel-conflict", "YouTube channel is already synchronized.") : failure("persistence-failure", "Channel synchronization persistence failed."); }
  }

  async recordNoChange(input: Readonly<{ userId: string; youtubeIdentityId: string; channelId: string; syncId: string; startedAt: string; completedAt: string }>): Promise<ChannelRepositoryResult<ChannelSynchronization>> {
    try { const row = await this.client.$transaction(async (transaction) => { await transaction.youTubeChannelRow.update({ where: { userId: input.userId }, data: { lastSyncedAt: new Date(input.completedAt), updatedAt: new Date(input.completedAt) } }); return transaction.channelSyncRow.create({ data: { ...input, outcome: "no-change", changedFields: [], startedAt: new Date(input.startedAt), completedAt: new Date(input.completedAt) } }); }); return this.mapSync(row); }
    catch { return failure("persistence-failure", "Channel synchronization persistence failed."); }
  }

  async recordFailure(input: Readonly<{ userId: string; youtubeIdentityId: string; channelId?: string; syncId: string; failureCode: string; startedAt: string; completedAt: string }>): Promise<ChannelRepositoryResult<ChannelSynchronization>> {
    try { const row = await this.client.channelSyncRow.create({ data: { ...input, outcome: "failed", changedFields: [], startedAt: new Date(input.startedAt), completedAt: new Date(input.completedAt) } }); return this.mapSync(row); }
    catch { return failure("persistence-failure", "Channel synchronization persistence failed."); }
  }

  private async findChannel(where: { userId: string } | { channelId: string }): Promise<ChannelRepositoryResult<YouTubeChannel>> { try { const row = await this.client.youTubeChannelRow.findUnique({ where }); if (!row) return failure("not-found", "Channel was not found."); const mapped = mapYouTubeChannelRow(row); return mapped ? success(mapped) : failure("persistence-failure", "Stored channel is invalid."); } catch { return failure("persistence-failure", "Channel persistence failed."); } }
  private mapSync(row: Parameters<typeof mapChannelSyncRow>[0]): ChannelRepositoryResult<ChannelSynchronization> { const mapped = mapChannelSyncRow(row); return mapped ? success(mapped) : failure("persistence-failure", "Stored channel synchronization is invalid."); }
}

function channelData(channel: YouTubeChannel) { return { youtubeIdentityId: channel.youtubeIdentityId, title: channel.title, handle: channel.handle ?? null, description: channel.description, publishedAt: new Date(channel.publishedAt), country: channel.country ?? null, customUrl: channel.customUrl ?? null, thumbnailUrl: channel.thumbnailUrl ?? null, bannerUrl: channel.bannerUrl ?? null, subscriberCount: channel.subscriberCount ?? null, viewCount: channel.viewCount, videoCount: channel.videoCount, hiddenSubscriberCount: channel.hiddenSubscriberCount, defaultLanguage: channel.defaultLanguage ?? null, keywords: [...channel.keywords], brandingSettings: { ...channel.brandingSettings, keywords: [...channel.brandingSettings.keywords] }, privacyStatus: channel.privacyStatus, sourceEtag: channel.sourceEtag ?? null, lastSyncedAt: new Date(channel.lastSyncedAt), syncStatus: channel.syncStatus, updatedAt: new Date(channel.updatedAt) }; }
function syncData(sync: ChannelSynchronization) { return { syncId: sync.syncId, userId: sync.userId, youtubeIdentityId: sync.youtubeIdentityId, channelId: sync.channelId ?? null, outcome: sync.outcome, changedFields: [...sync.changedFields], failureCode: sync.failureCode ?? null, startedAt: new Date(sync.startedAt), completedAt: new Date(sync.completedAt) }; }
