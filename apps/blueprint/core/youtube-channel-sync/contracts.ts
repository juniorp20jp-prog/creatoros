import type { YouTubeChannelSnapshot } from "./models";

export type YouTubeChannelApiErrorCode = "unauthorized" | "channel-not-found" | "channel-private" | "quota-exceeded" | "forbidden" | "api-failure";
export type YouTubeChannelApiResult =
  | Readonly<{ status: "success"; value: YouTubeChannelSnapshot }>
  | Readonly<{ status: "not-modified" }>
  | Readonly<{ status: "failure"; error: Readonly<{ code: YouTubeChannelApiErrorCode; message: string }> }>;

export interface YouTubeApiAdapter {
  fetchAuthenticatedChannel(accessToken: string, sourceEtag?: string): Promise<YouTubeChannelApiResult>;
}
