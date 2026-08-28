import type { ChannelSynchronization, YouTubeChannel } from "./models";

export type ChannelRepositoryErrorCode = "invalid-input" | "not-found" | "user-not-found" | "identity-not-found" | "channel-conflict" | "persistence-failure";
export type ChannelRepositoryResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: Readonly<{ code: ChannelRepositoryErrorCode; message: string }> }>;

export interface ChannelRepository {
  getByUserId(userId: string): Promise<ChannelRepositoryResult<YouTubeChannel>>;
  getByChannelId(channelId: string): Promise<ChannelRepositoryResult<YouTubeChannel>>;
}

export interface ChannelSyncRepository {
  getLatestByUserId(userId: string): Promise<ChannelRepositoryResult<ChannelSynchronization>>;
  listByUserId(userId: string, limit: number): Promise<ChannelRepositoryResult<ReadonlyArray<ChannelSynchronization>>>;
}

export interface ChannelSynchronizationRepository extends ChannelRepository, ChannelSyncRepository {
  complete(input: Readonly<{ channel: YouTubeChannel; synchronization: ChannelSynchronization }>): Promise<ChannelRepositoryResult<Readonly<{ channel: YouTubeChannel; synchronization: ChannelSynchronization }>>>;
  recordNoChange(input: Readonly<{ userId: string; youtubeIdentityId: string; channelId: string; syncId: string; startedAt: string; completedAt: string }>): Promise<ChannelRepositoryResult<ChannelSynchronization>>;
  recordFailure(input: Readonly<{ userId: string; youtubeIdentityId: string; channelId?: string; syncId: string; failureCode: string; startedAt: string; completedAt: string }>): Promise<ChannelRepositoryResult<ChannelSynchronization>>;
}
