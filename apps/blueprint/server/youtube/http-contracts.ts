import type {
  ChannelSynchronization,
  ChannelSynchronizationStatus,
  YouTubeChannel,
  YouTubeConnectionStatus,
} from "../../core";

export type YouTubeConnectionReadModel = YouTubeConnectionStatus;

export type YouTubeChannelReadModel = Omit<
  YouTubeChannel,
  "userId" | "youtubeIdentityId"
>;

export type YouTubeSynchronizationReadModel = Omit<
  ChannelSynchronization,
  "syncId" | "userId" | "youtubeIdentityId"
>;

export type YouTubeSynchronizationStatusReadModel = Readonly<{
  channelConnected: boolean;
  lastSync: YouTubeSynchronizationReadModel | null;
}>;

export type YouTubeSynchronizationResultReadModel = Readonly<{
  channel: YouTubeChannelReadModel;
  synchronization: YouTubeSynchronizationReadModel;
}>;

export type YouTubeApiErrorEnvelope = Readonly<{
  error: Readonly<{ code: string; message: string }>;
}>;

export type YouTubeApiDataEnvelope<TData> = Readonly<{ data: TData }>;

export function toYouTubeChannelReadModel(
  channel: YouTubeChannel,
): YouTubeChannelReadModel {
  const { userId, youtubeIdentityId, ...publicChannel } = channel;
  void userId;
  void youtubeIdentityId;
  return publicChannel;
}

export function toYouTubeSynchronizationReadModel(
  synchronization: ChannelSynchronization,
): YouTubeSynchronizationReadModel {
  const {
    syncId,
    userId,
    youtubeIdentityId,
    ...publicSynchronization
  } = synchronization;
  void syncId;
  void userId;
  void youtubeIdentityId;
  return publicSynchronization;
}

export function toYouTubeSynchronizationStatusReadModel(
  status: ChannelSynchronizationStatus,
): YouTubeSynchronizationStatusReadModel {
  return {
    channelConnected: status.channelConnected,
    lastSync: status.lastSync
      ? toYouTubeSynchronizationReadModel(status.lastSync)
      : null,
  };
}
