import assert from "node:assert/strict";
import { test } from "node:test";

import { GoogleYouTubeVideoApiAdapter } from "../youtube-video-api-adapter";

function video(id: string, overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id,
    etag: `etag-${id}`,
    snippet: {
      channelId: "UC_real",
      title: `Video ${id}`,
      description: "Description",
      publishedAt: "2026-08-20T10:00:00Z",
      thumbnails: {
        default: { url: "https://i.ytimg.com/default.jpg" },
        high: { url: "https://i.ytimg.com/high.jpg" },
      },
      tags: ["travel", "creator"],
      categoryId: "22",
      defaultLanguage: "es",
    },
    contentDetails: { duration: "PT2M3S" },
    statistics: {
      viewCount: "18446744073709551615",
      likeCount: "25",
      commentCount: "4",
    },
    status: { privacyStatus: "public" },
    ...overrides,
  };
}

test("adapter resolves uploads playlist then maps batched video details", async () => {
  const urls: string[] = [];
  let authorization = "";
  const adapter = new GoogleYouTubeVideoApiAdapter(async (input, init) => {
    const url = String(input);
    urls.push(url);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    if (url.includes("/channels?")) {
      return Response.json({
        items: [{
          id: "UC_real",
          contentDetails: { relatedPlaylists: { uploads: "UU_real" } },
        }],
      });
    }
    if (url.includes("/playlistItems?")) {
      return Response.json({
        items: [{ contentDetails: { videoId: "video-1" } }],
      });
    }
    return Response.json({ items: [video("video-1")] });
  });

  const result = await adapter.fetchUploadVideoWindow("private-token", { limit: 50 });
  assert.equal(result.status, "success");
  assert.equal(authorization, "Bearer private-token");
  assert.equal(urls.some((url) => url.includes("search")), false);
  assert.ok(urls.some((url) => url.includes("part=contentDetails")));
  assert.ok(urls.some((url) => url.includes("/playlistItems?")));
  assert.ok(urls.some((url) => url.includes("part=snippet%2CcontentDetails%2Cstatistics%2Cstatus")));
  if (result.status === "success") {
    const mapped = result.value.videos[0];
    assert.equal(mapped?.durationSeconds, 123);
    assert.equal(mapped?.viewCount, "18446744073709551615");
    assert.equal(mapped?.thumbnailUrl, "https://i.ytimg.com/high.jpg");
    assert.equal(JSON.stringify(result.value).includes("private-token"), false);
  }
});

test("adapter preserves missing optional statistics as absent", async () => {
  const adapter = sequenceAdapter([video("video-1", { statistics: { viewCount: "10" } })]);
  const result = await adapter.fetchUploadVideoWindow("token", { limit: 50 });
  if (result.status === "success") {
    assert.equal(result.value.videos[0]?.likeCount, undefined);
    assert.equal(result.value.videos[0]?.commentCount, undefined);
  }
});

test("adapter reports inaccessible video details without inventing rows", async () => {
  const adapter = sequenceAdapter([]);
  const result = await adapter.fetchUploadVideoWindow("token", { limit: 50 });
  if (result.status === "success") {
    assert.equal(result.value.discovered, 1);
    assert.equal(result.value.unavailable, 1);
    assert.deepEqual(result.value.videos, []);
  }
});

test("adapter exposes a future page cursor when the V1 window is truncated", async () => {
  const ids = Array.from({ length: 50 }, (_, index) => `video-${index + 1}`);
  const adapter = new GoogleYouTubeVideoApiAdapter(async (input) => {
    const url = String(input);
    if (url.includes("/channels?")) {
      return Response.json({
        items: [{
          id: "UC_real",
          contentDetails: { relatedPlaylists: { uploads: "UU_real" } },
        }],
      });
    }
    if (url.includes("/playlistItems?")) {
      return Response.json({
        items: ids.map((id) => ({ contentDetails: { videoId: id } })),
        nextPageToken: "opaque-next-page",
      });
    }
    return Response.json({ items: ids.map((id) => video(id)) });
  });
  const result = await adapter.fetchUploadVideoWindow("token", { limit: 50 });
  if (result.status === "success") {
    assert.equal(result.value.coverageCount, 50);
    assert.equal(result.value.coverageLimit, 50);
    assert.equal(result.value.truncated, true);
    assert.equal(result.value.nextPageCursor, "opaque-next-page");
  }
});

test("adapter backfills inaccessible uploads to preserve the accessible window", async () => {
  let playlistCalls = 0;
  const adapter = new GoogleYouTubeVideoApiAdapter(async (input) => {
    const url = String(input);
    if (url.includes("/channels?")) {
      return Response.json({
        items: [{
          id: "UC_real",
          contentDetails: { relatedPlaylists: { uploads: "UU_real" } },
        }],
      });
    }
    if (url.includes("/playlistItems?")) {
      playlistCalls += 1;
      return playlistCalls === 1
        ? Response.json({
            items: [{ contentDetails: { videoId: "unavailable" } }],
            nextPageToken: "second-page",
          })
        : Response.json({
            items: [
              { contentDetails: { videoId: "video-1" } },
              { contentDetails: { videoId: "video-2" } },
            ],
          });
    }
    const requested = new URL(url).searchParams.get("id");
    return Response.json({
      items: requested === "unavailable"
        ? []
        : [video("video-1"), video("video-2")],
    });
  });

  const result = await adapter.fetchUploadVideoWindow("token", { limit: 2 });
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.deepEqual(result.value.videos.map(({ videoId }) => videoId), [
      "video-1",
      "video-2",
    ]);
    assert.equal(result.value.discovered, 3);
    assert.equal(result.value.unavailable, 1);
    assert.equal(result.value.coverageCount, 2);
    assert.equal(result.value.truncated, false);
  }
});
test("adapter maps authorization, quota and provider errors safely", async () => {
  for (const [status, reason, expected] of [
    [401, "authError", "unauthorized"],
    [403, "quotaExceeded", "quota-exceeded"],
    [500, "backendError", "api-failure"],
  ] as const) {
    const adapter = new GoogleYouTubeVideoApiAdapter(async () =>
      Response.json(
        { error: { errors: [{ reason }] } },
        { status },
      ),
    );
    const result = await adapter.fetchUploadVideoWindow("secret-token", { limit: 50 });
    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, expected);
      assert.equal(result.error.message.includes("secret-token"), false);
    }
  }
});

function sequenceAdapter(items: ReadonlyArray<unknown>) {
  return new GoogleYouTubeVideoApiAdapter(async (input) => {
    const url = String(input);
    if (url.includes("/channels?")) {
      return Response.json({
        items: [{
          id: "UC_real",
          contentDetails: { relatedPlaylists: { uploads: "UU_real" } },
        }],
      });
    }
    if (url.includes("/playlistItems?")) {
      return Response.json({
        items: [{ contentDetails: { videoId: "video-1" } }],
      });
    }
    return Response.json({ items });
  });
}
