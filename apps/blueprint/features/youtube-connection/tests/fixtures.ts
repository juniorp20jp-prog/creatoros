import type {
  YouTubeChannelReadModel,
  YouTubeConnectionReadModel,
  YouTubeSynchronizationReadModel,
  YouTubeSynchronizationResultReadModel,
  YouTubeSynchronizationStatusReadModel,
} from "../../../server/youtube/http-contracts";

export const connectedStatus: YouTubeConnectionReadModel = {
  connected: true,
  channelId: "UC_real_channel",
  channelTitle: "Real Creator Channel",
  scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
  connectedAt: "2026-08-28T14:00:00.000Z",
  updatedAt: "2026-08-28T14:00:00.000Z",
};

export const disconnectedStatus: YouTubeConnectionReadModel = {
  connected: false,
  scopes: [],
};

export const realChannel: YouTubeChannelReadModel = {
  channelId: "UC_real_channel",
  title: "Real Creator Channel",
  handle: "@realcreator",
  description: "A real synchronized channel snapshot.",
  publishedAt: "2018-03-01T00:00:00.000Z",
  customUrl: "@realcreator",
  thumbnailUrl: "https://yt3.ggpht.com/channel-avatar=s88-c-k-c0x00ffffff-no-rj",
  subscriberCount: "900719925474099312345",
  viewCount: "18446744073709551615",
  videoCount: "427",
  hiddenSubscriberCount: false,
  keywords: ["creator", "education"],
  brandingSettings: { keywords: ["creator", "education"] },
  privacyStatus: "public",
  sourceEtag: "etag-real-channel",
  lastSyncedAt: "2026-08-28T15:00:00.000Z",
  syncStatus: "synced",
  createdAt: "2026-08-28T14:00:00.000Z",
  updatedAt: "2026-08-28T15:00:00.000Z",
};

export const completedSync: YouTubeSynchronizationReadModel = {
  channelId: realChannel.channelId,
  outcome: "completed",
  changedFields: ["title"],
  startedAt: "2026-08-28T14:59:59.000Z",
  completedAt: "2026-08-28T15:00:00.000Z",
};

export const noChangeSync: YouTubeSynchronizationReadModel = {
  ...completedSync,
  outcome: "no-change",
  changedFields: [],
  startedAt: "2026-08-28T15:05:00.000Z",
  completedAt: "2026-08-28T15:05:01.000Z",
};

export const synchronizationStatus: YouTubeSynchronizationStatusReadModel = {
  channelConnected: true,
  lastSync: completedSync,
};

export const completedResult: YouTubeSynchronizationResultReadModel = {
  channel: realChannel,
  synchronization: completedSync,
};

export function successResponse(data: unknown): Response {
  return Response.json({ data });
}

export function errorResponse(status: number, code: string): Response {
  return Response.json({ error: { code, message: "Safe provider message." } }, { status });
}

export function createYouTubeFetch(options: Readonly<{
  connection?: YouTubeConnectionReadModel;
  channel?: YouTubeChannelReadModel | null;
  synchronizationStatus?: YouTubeSynchronizationStatusReadModel;
  synchronize?: () => Promise<Response> | Response;
  disconnect?: () => Promise<Response> | Response;
}> = {}): typeof globalThis.fetch {
  return async (input, init) => {
    const url = new URL(String(input), "http://localhost:3002");
    if (url.pathname === "/api/youtube/status") return successResponse(options.connection ?? connectedStatus);
    if (url.pathname === "/api/youtube/channel/status") return successResponse(options.synchronizationStatus ?? synchronizationStatus);
    if (url.pathname === "/api/youtube/channel" && init?.method !== "POST") return successResponse(options.channel === undefined ? realChannel : options.channel);
    if (url.pathname === "/api/youtube/channel/sync") return options.synchronize ? options.synchronize() : successResponse(completedResult);
    if (url.pathname === "/api/youtube/disconnect") return options.disconnect ? options.disconnect() : successResponse(disconnectedStatus);
    return errorResponse(404, "NOT_FOUND");
  };
}
