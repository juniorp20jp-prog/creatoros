import assert from "node:assert/strict";
import { test } from "node:test";

import { GoogleYouTubeAnalyticsApiAdapter, parseChannelReport, parseVideoReport } from "../youtube-analytics-api-adapter";

test("header-driven parser accepts reordered columns and ignores additional columns", () => {
  const result = parseChannelReport({ columnHeaders: [{ name: "views" }, { name: "unexpected" }, { name: "day" }, { name: "averageViewDuration" }], rows: [[10, "ignored", "2026-09-10", 22.5]] });
  assert.equal(result.status, "success");
  if (result.status === "success") assert.deepEqual(result.value.rows[0]?.values, { views: "10", averageViewDuration: "22.5" });
});

test("parser represents no rows and missing optional metrics without fabricating values", () => {
  const result = parseChannelReport({ columnHeaders: [{ name: "day" }, { name: "views" }], rows: [] });
  assert.equal(result.status, "success");
  if (result.status === "success") assert.deepEqual(result.value.rows, []);
});

test("parser rejects malformed row/header shape and unsafe numeric values", () => {
  assert.equal(parseChannelReport({ columnHeaders: [{ name: "day" }, { name: "views" }], rows: [["2026-09-10"]] }).status, "failure");
  assert.equal(parseChannelReport({ columnHeaders: [{ name: "day" }, { name: "views" }], rows: [["2026-09-10", Number.MAX_SAFE_INTEGER + 1]] }).status, "failure");
});

test("video parser excludes IDs outside the owned managed-video set", () => {
  const result = parseVideoReport({ columnHeaders: [{ name: "video" }, { name: "day" }, { name: "views" }], rows: [["owned", "2026-09-10", 5], ["foreign", "2026-09-10", 9]] }, new Set(["owned"]));
  assert.equal(result.status, "success");
  if (result.status === "success") { assert.equal(result.value.rows.length, 1); assert.equal(result.value.filteredUnknownVideoCount, 1); }
});

test("adapter uses channel==MINE, grouped video filters, no-store, and no monetary metrics", async () => {
  const requests: URL[] = [];
  const adapter = new GoogleYouTubeAnalyticsApiAdapter(async (input, init) => {
    const url = new URL(String(input)); requests.push(url);
    assert.equal(init?.cache, "no-store");
    assert.equal(String(new Headers(init?.headers).get("authorization")).startsWith("Bearer "), true);
    return url.searchParams.get("dimensions") === "day,video"
      ? Response.json({ columnHeaders: [{ name: "video" }, { name: "day" }, { name: "views" }], rows: [["owned-1", "2026-09-10", 1]] })
      : Response.json({ columnHeaders: [{ name: "day" }, { name: "views" }], rows: [["2026-09-10", 1]] });
  });
  const result = await adapter.collect({ accessToken: "secret-access", channelId: "channel", videoIds: ["owned-1", "owned-2"], startDate: "2026-09-01", endDate: "2026-09-12", collectedAt: AS_OF });
  assert.equal(result.status, "success");
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.searchParams.get("ids"), "channel==MINE");
  assert.equal(requests[1]?.searchParams.get("filters"), "video==owned-1,owned-2");
  assert.equal(requests[0]?.searchParams.get("metrics")?.includes("revenue"), false);
  assert.equal(requests[0]?.searchParams.get("metrics")?.includes("impressions"), false);
});

test("adapter distinguishes quota failures from revoked authorization without leaking provider bodies", async () => {
  const quota = new GoogleYouTubeAnalyticsApiAdapter(async () => Response.json({ error: { errors: [{ reason: "quotaExceeded" }], message: "private provider detail" } }, { status: 403 }));
  const unauthorized = new GoogleYouTubeAnalyticsApiAdapter(async () => Response.json({ error: { errors: [{ reason: "insufficientPermissions" }] } }, { status: 403 }));
  const input = { accessToken: "secret-access", channelId: "channel", videoIds: [], startDate: "2026-09-01", endDate: "2026-09-12", collectedAt: AS_OF };
  const quotaResult = await quota.collect(input);
  const authResult = await unauthorized.collect(input);
  assert.equal(quotaResult.status, "failure");
  assert.equal(authResult.status, "failure");
  if (quotaResult.status === "failure") {
    assert.equal(quotaResult.error.code, "quota");
    assert.equal(quotaResult.error.message.includes("private provider detail"), false);
  }
  if (authResult.status === "failure") assert.equal(authResult.error.code, "authorization");
});

const AS_OF = "2026-09-12T12:00:00.000Z";
