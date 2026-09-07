import type { YouTubeVideoSnapshot } from "./models";

export type YouTubeVideoApiErrorCode =
  | "unauthorized"
  | "channel-not-found"
  | "quota-exceeded"
  | "forbidden"
  | "api-failure";

export type YouTubeVideoWindow = Readonly<{
  channelId: string;
  videos: ReadonlyArray<YouTubeVideoSnapshot>;
  discovered: number;
  unavailable: number;
  coverageCount: number;
  coverageLimit: number;
  truncated: boolean;
  nextPageCursor?: string;
}>;

export type YouTubeVideoApiResult =
  | Readonly<{ status: "success"; value: YouTubeVideoWindow }>
  | Readonly<{
      status: "failure";
      error: Readonly<{ code: YouTubeVideoApiErrorCode; message: string }>;
    }>;

export interface YouTubeVideoApiAdapter {
  fetchUploadVideoWindow(
    accessToken: string,
    input: Readonly<{ limit: number; pageCursor?: string }>,
  ): Promise<YouTubeVideoApiResult>;
}
