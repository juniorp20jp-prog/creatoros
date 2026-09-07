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

export type YouTubeVideoReadModel = Omit<
  import("../../core").YouTubeVideo,
  "userId"
>;

export type YouTubeVideoSynchronizationReadModel = Omit<
  import("../../core").VideoSynchronization,
  "syncId" | "userId" | "youtubeIdentityId"
>;

export type YouTubeVideoPageReadModel = Readonly<{
  videos: ReadonlyArray<YouTubeVideoReadModel>;
  nextCursor?: string;
}>;

export type YouTubeVideoSynchronizationStatusReadModel = Readonly<{
  videoCount: number;
  lastSync: YouTubeVideoSynchronizationReadModel | null;
}>;

export type YouTubeVideoSynchronizationResultReadModel = Readonly<{
  videos: ReadonlyArray<YouTubeVideoReadModel>;
  synchronization: YouTubeVideoSynchronizationReadModel;
}>;

export type RealYouTubeIntelligenceReadModel = Readonly<{
  output: import("../../core").YouTubeIntelligenceOutput;
  excludedVideoCount: number;
  synchronization: YouTubeVideoSynchronizationReadModel | null;
}>;

export function toVideoPageReadModel(
  video: import("../../core").YouTubeVideo,
): YouTubeVideoReadModel {
  const { userId, ...publicVideo } = video;
  void userId;
  return publicVideo;
}

export function toVideoSynchronizationReadModel(
  synchronization: import("../../core").VideoSynchronization,
): YouTubeVideoSynchronizationReadModel {
  const { syncId, userId, youtubeIdentityId, ...publicSynchronization } =
    synchronization;
  void syncId;
  void userId;
  void youtubeIdentityId;
  return publicSynchronization;
}

export function toVideoSynchronizationStatusReadModel(
  status: import("../../core").VideoSynchronizationStatus,
): YouTubeVideoSynchronizationStatusReadModel {
  return {
    videoCount: status.videoCount,
    lastSync: status.lastSync
      ? toVideoSynchronizationReadModel(status.lastSync)
      : null,
  };
}

export function toRealYouTubeIntelligenceReadModel(
  value: Readonly<{
    output: import("../../core").YouTubeIntelligenceOutput;
    excludedVideoCount: number;
    synchronization: import("../../core").VideoSynchronization | null;
  }>,
): RealYouTubeIntelligenceReadModel {
  return {
    output: value.output,
    excludedVideoCount: value.excludedVideoCount,
    synchronization: value.synchronization
      ? toVideoSynchronizationReadModel(value.synchronization)
      : null,
  };
}
