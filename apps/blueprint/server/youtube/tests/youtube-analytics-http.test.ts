import assert from "node:assert/strict";
import { test } from "node:test";

import type { YouTubeAnalyticsCollectionService } from "../../../core";
import type { CurrentSessionResolver } from "../../auth";
import { YouTubeAnalyticsHttpHandlers } from "../youtube-analytics-http";

const principal = { userId: "user", email: "user@example.com", displayName: "User", locale: "es", sessionId: "session" } as const;
const authenticated = { resolveCurrentSession: async () => ({ status: "authenticated" as const, principal }) } as unknown as CurrentSessionResolver;
const unauthenticated = { resolveCurrentSession: async () => ({ status: "unauthenticated" as const }) } as unknown as CurrentSessionResolver;

function service(overrides: Partial<Record<"status" | "collect" | "channel" | "video", unknown>> = {}) {
  return {
    status: async () => ({ status: "success", value: { userId: "user", state: "authorized", updatedAt: "2026-09-12T00:00:00.000Z" } }),
    collect: async () => ({ status: "success", value: { batchId: "batch", channelId: "channel", outcome: "no-data", channelRowCount: 0, videoRowCount: 0 } }),
    channel: async () => ({ status: "success", value: { period: "30d", values: {}, availableFields: [], missingFields: [], channelDays: 0 } }),
    video: async () => ({ status: "success", value: [] }),
    ...overrides,
  } as unknown as YouTubeAnalyticsCollectionService;
}

test("Analytics HTTP endpoints require a CreatorOS session", async () => {
  const handlers = new YouTubeAnalyticsHttpHandlers(unauthenticated, async () => service());
  assert.equal((await handlers.status(new Request("http://localhost/api/youtube/analytics/status"))).status, 401);
  assert.equal((await handlers.synchronize(new Request("http://localhost/api/youtube/analytics/sync", { method: "POST" }))).status, 401);
});

test("Analytics status omits ownership identifiers and disables caching", async () => {
  const handlers = new YouTubeAnalyticsHttpHandlers(authenticated, async () => service());
  const response = await handlers.status(new Request("http://localhost/api/youtube/analytics/status"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json() as { data: Record<string, unknown> };
  assert.equal("userId" in body.data, false);
  assert.equal(body.data.state, "authorized");
});

test("Analytics HTTP validates bounded periods and maps missing capability safely", async () => {
  const invalid = new YouTubeAnalyticsHttpHandlers(authenticated, async () => service());
  assert.equal((await invalid.synchronize(new Request("http://localhost/api/youtube/analytics/sync?period=365d", { method: "POST" }))).status, 400);
  const missing = new YouTubeAnalyticsHttpHandlers(authenticated, async () => service({ collect: async () => ({ status: "failure", error: { code: "not-authorized", message: "internal" } }) }));
  const response = await missing.synchronize(new Request("http://localhost/api/youtube/analytics/sync", { method: "POST" }));
  assert.equal(response.status, 403);
  assert.equal(JSON.stringify(await response.json()).includes("internal"), false);
});

test("Analytics HTTP returns a safe conflict for overlapping collection", async () => {
  const handlers = new YouTubeAnalyticsHttpHandlers(authenticated, async () => service({ collect: async () => ({ status: "failure", error: { code: "collection-in-progress", message: "internal owner detail" } }) }));
  const response = await handlers.synchronize(new Request("http://localhost/api/youtube/analytics/sync", { method: "POST" }));
  assert.equal(response.status, 409);
  const body = JSON.stringify(await response.json());
  assert.equal(body.includes("internal owner detail"), false);
  assert.equal(body.includes("YOUTUBE_ANALYTICS_COLLECTION_IN_PROGRESS"), true);
});

test("Analytics channel and video reads use the authenticated owner only", async () => {
  const seen: string[] = [];
  const handlers = new YouTubeAnalyticsHttpHandlers(authenticated, async () => service({ channel: async (userId: string) => { seen.push(userId); return { status: "success", value: { period: "30d", values: {}, availableFields: [], missingFields: [], channelDays: 0 } }; }, video: async (userId: string) => { seen.push(userId); return { status: "success", value: [] }; } }));
  assert.equal((await handlers.channel(new Request("http://localhost/api/youtube/analytics/channel?period=30d"))).status, 200);
  assert.equal((await handlers.videos(new Request("http://localhost/api/youtube/analytics/videos?period=30d"))).status, 200);
  assert.deepEqual(seen, ["user", "user"]);
});

test("Analytics synchronization omits internal ownership identifiers", async () => {
  const handlers = new YouTubeAnalyticsHttpHandlers(authenticated, async () => service({ collect: async () => ({ status: "success", value: { batchId: "batch", userId: "internal-user", channelId: "channel", requestedStartDate: "2026-09-01", requestedEndDate: "2026-09-12", collectedAt: "2026-09-12T00:00:00.000Z", outcome: "no-data", availableFields: [], missingFields: [], channelRowCount: 0, videoRowCount: 0, videoCoverageCount: 0, videoCoverageLimit: 50 } }) }));
  const response = await handlers.synchronize(new Request("http://localhost/api/youtube/analytics/sync", { method: "POST" }));
  assert.equal(response.status, 200);
  const body = await response.json() as { data: Record<string, unknown> };
  assert.equal("userId" in body.data, false);
});
