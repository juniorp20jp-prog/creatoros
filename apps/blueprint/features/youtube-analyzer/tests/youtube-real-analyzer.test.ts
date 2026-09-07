import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { act, renderHook, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";

import { executeYouTubeIntelligence } from "../../../core";
import type {
  RealYouTubeIntelligenceReadModel,
  YouTubeVideoSynchronizationReadModel,
} from "../../../server/youtube/http-contracts";
import { youtubeAnalyzerScenarios } from "../fixtures";
import { YouTubeVideoApiClient } from "../client";
import { useRealYouTubeAnalyzer } from "../hooks";

let dom: JSDOM;
const sync: YouTubeVideoSynchronizationReadModel = {
  channelId: "UC_complete",
  outcome: "completed",
  counts: {
    discovered: 8,
    created: 8,
    updated: 0,
    unchanged: 0,
    unavailable: 0,
  },
  coverageCount: 8,
  coverageLimit: 50,
  truncated: false,
  startedAt: "2026-09-02T12:00:00.000Z",
  completedAt: "2026-09-02T12:00:01.000Z",
};

before(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3002",
  });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    Node: { configurable: true, value: dom.window.Node },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver },
    DOMException: { configurable: true, value: dom.window.DOMException },
    IS_REACT_ACT_ENVIRONMENT: {
      configurable: true,
      value: true,
      writable: true,
    },
  });
});
after(() => {
  dom.window.close();
  for (const name of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Node",
    "MutationObserver",
    "DOMException",
    "IS_REACT_ACT_ENVIRONMENT",
  ]) Reflect.deleteProperty(globalThis, name);
});

async function intelligence(): Promise<RealYouTubeIntelligenceReadModel> {
  const result = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.complete,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") throw new Error("fixture failed");
  return { output: result.output, excludedVideoCount: 0, synchronization: sync };
}

test("video API client uses only authenticated internal routes and validates envelopes", async () => {
  const output = await intelligence();
  const requests: Array<{ url: string; method: string }> = [];
  const client = new YouTubeVideoApiClient(async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? "GET" });
    if (url.includes("/status")) {
      return Response.json({ data: { videoCount: 8, lastSync: sync } });
    }
    if (url.includes("/intelligence")) return Response.json({ data: output });
    if (url.includes("/sync")) {
      return Response.json({ data: { videos: [], synchronization: sync } });
    }
    return Response.json({ data: { videos: [], nextCursor: "cursor" } });
  });
  await client.list({ limit: 50 });
  await client.status();
  await client.synchronize();
  await client.analyze();
  assert.deepEqual(requests, [
    { url: "/api/youtube/videos?limit=50", method: "GET" },
    { url: "/api/youtube/videos/status", method: "GET" },
    { url: "/api/youtube/videos/sync", method: "POST" },
    { url: "/api/youtube/intelligence", method: "POST" },
  ]);
});

test("real analyzer hook exposes empty state honestly", async () => {
  const client = {
    list: async () => ({ videos: [] }),
    status: async () => ({ videoCount: 0, lastSync: null }),
  } as unknown as YouTubeVideoApiClient;
  const hook = renderHook(() => useRealYouTubeAnalyzer(client));
  await waitFor(() => assert.equal(hook.result.current.phase, "empty"));
  hook.unmount();
});

test("real analyzer hook loads persisted intelligence successfully", async () => {
  const output = await intelligence();
  const client = {
    list: async () => ({
      videos: [{
        videoId: "video",
        channelId: "UC_complete",
        title: "Video",
        description: "",
        publishedAt: "2026-08-01T00:00:00.000Z",
        durationSeconds: 60,
        availabilityStatus: "available",
        lastSeenAt: sync.completedAt,
        lastSyncedAt: sync.completedAt,
        createdAt: sync.completedAt,
        updatedAt: sync.completedAt,
      }],
    }),
    status: async () => ({ videoCount: 1, lastSync: sync }),
    analyze: async () => output,
  } as unknown as YouTubeVideoApiClient;
  const hook = renderHook(() => useRealYouTubeAnalyzer(client));
  await waitFor(() => assert.equal(hook.result.current.phase, "success"));
  assert.equal(hook.result.current.intelligence?.output.summary.analyzedVideoCount, 8);
  hook.unmount();
});

test("synchronize-and-analyze prevents double submission and reports no-change", async () => {
  const output = await intelligence();
  let synchronizationCount = 0;
  const client = {
    list: async () => ({ videos: [] }),
    status: async () => ({ videoCount: 0, lastSync: null }),
    synchronize: async () => {
      synchronizationCount += 1;
      await Promise.resolve();
      return {
        videos: [],
        synchronization: { ...sync, outcome: "no-change" as const },
      };
    },
    analyze: async () => output,
  } as unknown as YouTubeVideoApiClient;
  const hook = renderHook(() => useRealYouTubeAnalyzer(client));
  await waitFor(() => assert.equal(hook.result.current.phase, "empty"));
  await act(async () => {
    await Promise.all([
      hook.result.current.synchronizeAndAnalyze(),
      hook.result.current.synchronizeAndAnalyze(),
    ]);
  });
  assert.equal(synchronizationCount, 1);
  assert.equal(hook.result.current.phase, "success");
  assert.equal(hook.result.current.outcome, "no-change");
  hook.unmount();
});

test("real analyzer hook exposes safe error and supports retry", async () => {
  let fails = true;
  const client = {
    list: async () => {
      if (fails) throw new Error("private backend detail");
      return { videos: [] };
    },
    status: async () => ({ videoCount: 0, lastSync: null }),
  } as unknown as YouTubeVideoApiClient;
  const hook = renderHook(() => useRealYouTubeAnalyzer(client));
  await waitFor(() => assert.equal(hook.result.current.phase, "error"));
  fails = false;
  await act(async () => {
    await hook.result.current.reload();
  });
  assert.equal(hook.result.current.phase, "empty");
  hook.unmount();
});
