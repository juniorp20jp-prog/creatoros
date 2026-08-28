import type { ChannelSynchronization, YouTubeChannel } from "./models";
import type { ChannelRepositoryResult, ChannelSynchronizationRepository } from "./repositories";

export class InMemoryChannelSynchronizationRepository implements ChannelSynchronizationRepository {
  private readonly channels = new Map<string, YouTubeChannel>();
  private readonly synchronizations: ChannelSynchronization[] = [];

  async getByUserId(userId: string): Promise<ChannelRepositoryResult<YouTubeChannel>> { const value = [...this.channels.values()].find((item) => item.userId === userId.trim()); return value ? success(value) : notFound("Channel was not found."); }
  async getByChannelId(channelId: string): Promise<ChannelRepositoryResult<YouTubeChannel>> { const value = this.channels.get(channelId.trim()); return value ? success(value) : notFound("Channel was not found."); }
  async getLatestByUserId(userId: string): Promise<ChannelRepositoryResult<ChannelSynchronization>> { const value = this.synchronizations.filter((item) => item.userId === userId.trim()).sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]; return value ? success(value) : notFound("Channel synchronization was not found."); }
  async listByUserId(userId: string, limit: number): Promise<ChannelRepositoryResult<ReadonlyArray<ChannelSynchronization>>> { return success(this.synchronizations.filter((item) => item.userId === userId.trim()).sort((left, right) => right.startedAt.localeCompare(left.startedAt)).slice(0, limit)); }

  async complete(input: Readonly<{ channel: YouTubeChannel; synchronization: ChannelSynchronization }>): Promise<ChannelRepositoryResult<Readonly<{ channel: YouTubeChannel; synchronization: ChannelSynchronization }>>> {
    const conflict = [...this.channels.values()].find((item) => item.channelId === input.channel.channelId && item.userId !== input.channel.userId);
    if (conflict) return failure("channel-conflict", "YouTube channel is already synchronized.");
    this.channels.set(input.channel.channelId, structuredClone(input.channel));
    this.synchronizations.push(structuredClone(input.synchronization));
    return success(input);
  }

  async recordNoChange(input: Readonly<{ userId: string; youtubeIdentityId: string; channelId: string; syncId: string; startedAt: string; completedAt: string }>): Promise<ChannelRepositoryResult<ChannelSynchronization>> {
    const channel = await this.getByUserId(input.userId);
    if (channel.status === "failure") return channel;
    this.channels.set(channel.value.channelId, { ...channel.value, lastSyncedAt: input.completedAt, updatedAt: input.completedAt });
    const synchronization: ChannelSynchronization = { ...input, outcome: "no-change", changedFields: [] };
    this.synchronizations.push(synchronization);
    return success(synchronization);
  }

  async recordFailure(input: Readonly<{ userId: string; youtubeIdentityId: string; channelId?: string; syncId: string; failureCode: string; startedAt: string; completedAt: string }>): Promise<ChannelRepositoryResult<ChannelSynchronization>> {
    const synchronization: ChannelSynchronization = { ...input, outcome: "failed", changedFields: [] };
    this.synchronizations.push(synchronization);
    return success(synchronization);
  }
}

function success<TValue>(value: TValue): ChannelRepositoryResult<TValue> { return { status: "success", value: structuredClone(value) }; }
function failure<TValue>(code: "channel-conflict", message: string): ChannelRepositoryResult<TValue> { return { status: "failure", error: { code, message } }; }
function notFound<TValue>(message: string): ChannelRepositoryResult<TValue> { return { status: "failure", error: { code: "not-found", message } }; }
