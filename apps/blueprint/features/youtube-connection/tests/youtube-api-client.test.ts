import assert from "node:assert/strict";
import { test } from "node:test";

import {
  YouTubeApiClient,
  YouTubeApiClientError,
} from "../client";
import {
  connectedStatus,
  createYouTubeFetch,
  errorResponse,
  realChannel,
  successResponse,
} from "./fixtures";

test("YouTubeApiClient consumes only the internal YouTube HTTP routes", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const client = new YouTubeApiClient({
    fetch: async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? "GET" });
      return createYouTubeFetch()(input, init);
    },
  });

  await client.getConnectionStatus();
  await client.getChannel();
  await client.getSynchronizationStatus();
  await client.synchronize();
  await client.disconnect();

  assert.deepEqual(requests.map(({ url }) => url), [
    "/api/youtube/status",
    "/api/youtube/channel",
    "/api/youtube/channel/status",
    "/api/youtube/channel/sync",
    "/api/youtube/disconnect",
  ]);
  assert.equal(requests[3]?.method, "POST");
  assert.equal(requests[4]?.method, "POST");
});

test("client preserves channel counters as lossless decimal strings", async () => {
  const client = new YouTubeApiClient({ fetch: createYouTubeFetch() });
  const channel = await client.getChannel();
  assert.equal(channel?.subscriberCount, realChannel.subscriberCount);
  assert.equal(channel?.viewCount, "18446744073709551615");
  assert.equal(typeof channel?.viewCount, "string");
});

test("client validates envelopes instead of trusting malformed payloads", async () => {
  const client = new YouTubeApiClient({ fetch: async () => successResponse({ connected: "yes" }) });
  await assert.rejects(
    client.getConnectionStatus(),
    (error: unknown) => error instanceof YouTubeApiClientError && error.kind === "invalid-response",
  );
});

test("client maps authentication and provider failures without exposing internal codes", async () => {
  const unauthorized = new YouTubeApiClient({ fetch: async () => errorResponse(401, "AUTHENTICATION_REQUIRED") });
  const provider = new YouTubeApiClient({ fetch: async () => errorResponse(429, "YOUTUBE_QUOTA_EXCEEDED") });
  await assert.rejects(unauthorized.getConnectionStatus(), (error: unknown) => error instanceof YouTubeApiClientError && error.kind === "unauthenticated" && !("code" in error));
  await assert.rejects(provider.synchronize(), (error: unknown) => error instanceof YouTubeApiClientError && error.kind === "provider" && error.retryable);
});

test("connect URL keeps navigation local and returns to the selected locale", () => {
  const client = new YouTubeApiClient();
  assert.equal(client.getConnectUrl("pt-BR"), "/api/youtube/connect?returnTo=%2Fpt-BR%2Fyoutube-analyzer");
  assert.deepEqual(connectedStatus.scopes, ["https://www.googleapis.com/auth/youtube.readonly"]);
});
