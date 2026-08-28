import assert from "node:assert/strict";
import { test } from "node:test";

import { GoogleYouTubeApiAdapter } from "../youtube-api-adapter";

const resource = { etag: "etag-real", id: "UC_real", snippet: { title: "Real Channel", description: "Description", customUrl: "@real", publishedAt: "2020-01-01T00:00:00Z", country: "US", defaultLanguage: "en", thumbnails: { high: { url: "https://yt.example/thumb.jpg" } } }, statistics: { subscriberCount: "1234", viewCount: "9000", videoCount: "42", hiddenSubscriberCount: false }, brandingSettings: { channel: { title: "Real Channel", description: "Description", keywords: 'creator "long form"', defaultLanguage: "en", country: "US" }, image: { bannerExternalUrl: "https://yt.example/banner.jpg" } }, status: { privacyStatus: "public" } };

test("adapter maps the official channel resource without returning credentials", async () => {
  let authorization = "";
  const adapter = new GoogleYouTubeApiAdapter(async (_input, init) => { authorization = new Headers(init?.headers).get("authorization") ?? ""; return Response.json({ items: [resource] }); });
  const result = await adapter.fetchAuthenticatedChannel("private-access-token");
  assert.equal(authorization, "Bearer private-access-token");
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.value.handle, "@real");
    assert.deepEqual(result.value.keywords, ["creator", "long form"]);
    assert.equal(result.value.subscriberCount, "1234");
    assert.equal(JSON.stringify(result.value).includes("private-access-token"), false);
  }
});

test("adapter supports ETag incremental requests and 304", async () => {
  let etag = "";
  const adapter = new GoogleYouTubeApiAdapter(async (_input, init) => { etag = new Headers(init?.headers).get("if-none-match") ?? ""; return new Response(null, { status: 304 }); });
  assert.deepEqual(await adapter.fetchAuthenticatedChannel("token", "etag-1"), { status: "not-modified" });
  assert.equal(etag, "etag-1");
});

test("adapter maps missing channels, quota, authorization and generic failures", async () => {
  const cases = [
    { response: Response.json({ items: [] }), code: "channel-not-found" },
    { response: Response.json({ error: { errors: [{ reason: "quotaExceeded" }] } }, { status: 403 }), code: "quota-exceeded" },
    { response: Response.json({ error: {} }, { status: 401 }), code: "unauthorized" },
    { response: Response.json({ error: {} }, { status: 500 }), code: "api-failure" },
  ];
  for (const fixture of cases) {
    const adapter = new GoogleYouTubeApiAdapter(async () => fixture.response.clone());
    const result = await adapter.fetchAuthenticatedChannel("token");
    assert.equal(result.status, "failure");
    if (result.status === "failure") assert.equal(result.error.code, fixture.code);
  }
});

test("hidden subscriber count remains absent instead of being fabricated", async () => {
  const adapter = new GoogleYouTubeApiAdapter(async () => Response.json({ items: [{ ...resource, statistics: { ...resource.statistics, hiddenSubscriberCount: true, subscriberCount: undefined } }] }));
  const result = await adapter.fetchAuthenticatedChannel("token");
  if (result.status === "success") assert.equal(result.value.subscriberCount, undefined);
});
