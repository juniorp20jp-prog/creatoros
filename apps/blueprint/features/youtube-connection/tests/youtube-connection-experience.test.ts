import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { act, cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";
import { createElement } from "react";

import en from "../../../messages/en.json";
import { YouTubeApiClient } from "../client";
import { YouTubeConnectionExperience } from "../components/YouTubeConnectionExperience";
import { formatYouTubeCounter } from "../formatters";
import { useYouTubeConnection } from "../hooks";
import {
  completedResult,
  createYouTubeFetch,
  disconnectedStatus,
  errorResponse,
  noChangeSync,
  realChannel,
  successResponse,
} from "./fixtures";

let dom: JSDOM;

before(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3002/en/youtube-analyzer" });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    HTMLImageElement: { configurable: true, value: dom.window.HTMLImageElement },
    Node: { configurable: true, value: dom.window.Node },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
  });
});

afterEach(() => cleanup());

after(() => {
  dom.window.close();
  for (const name of ["window", "document", "navigator", "HTMLElement", "HTMLImageElement", "Node", "MutationObserver", "IS_REACT_ACT_ENVIRONMENT"]) {
    Reflect.deleteProperty(globalThis, name);
  }
});

test("not connected renders the official OAuth CTA", async () => {
  const client = new YouTubeApiClient({ fetch: createYouTubeFetch({ connection: disconnectedStatus }) });
  const view = render(createElement(YouTubeConnectionExperience, { client, content: en.blueprint.youtubeAnalyzer.connection, locale: "en" }));
  const connect = await view.findByRole("link", { name: en.blueprint.youtubeAnalyzer.connection.connect });
  assert.equal(connect.getAttribute("href"), "/api/youtube/connect?returnTo=%2Fen%2Fyoutube-analyzer");
});

test("connected state renders the real thumbnail, identity, and metrics", async () => {
  const client = new YouTubeApiClient({ fetch: createYouTubeFetch({ channel: realChannel }) });
  const view = render(createElement(YouTubeConnectionExperience, { client, content: en.blueprint.youtubeAnalyzer.connection, locale: "en" }));
  assert.ok(await view.findByRole("heading", { name: realChannel.title }));
  const avatarName = realChannel.title + " — " + en.blueprint.youtubeAnalyzer.connection.channelAvatar;
  const avatar = view.getByRole("img", { name: avatarName });
  assert.equal(avatar.getAttribute("src"), realChannel.thumbnailUrl);
  assert.ok(view.getByText(realChannel.handle ?? ""));
  assert.ok(view.getByText(formatYouTubeCounter(realChannel.subscriberCount, "en", "N/A")));
  assert.ok(view.getByText(formatYouTubeCounter(realChannel.viewCount, "en", "N/A")));
  assert.ok(view.getByText(formatYouTubeCounter(realChannel.videoCount, "en", "N/A")));
  assert.ok(view.getByText(en.blueprint.youtubeAnalyzer.connection.realData));
  assert.equal(view.queryByText("Creator Lab Complete"), null);
});

test("missing channel thumbnail renders a safe fallback without a broken image", async () => {
  const client = new YouTubeApiClient({ fetch: createYouTubeFetch({ channel: { ...realChannel, thumbnailUrl: undefined } }) });
  const view = render(createElement(YouTubeConnectionExperience, { client, content: en.blueprint.youtubeAnalyzer.connection, locale: "en" }));
  assert.ok(await view.findByRole("heading", { name: realChannel.title }));
  assert.ok(view.getByRole("img", { name: en.blueprint.youtubeAnalyzer.connection.channelAvatarUnavailable }));
  assert.equal(view.queryByRole("img", { name: realChannel.title + " — " + en.blueprint.youtubeAnalyzer.connection.channelAvatar }), null);
});

test("failed channel thumbnail is replaced by the safe fallback", async () => {
  const client = new YouTubeApiClient({ fetch: createYouTubeFetch({ channel: realChannel }) });
  const view = render(createElement(YouTubeConnectionExperience, { client, content: en.blueprint.youtubeAnalyzer.connection, locale: "en" }));
  const avatarName = realChannel.title + " — " + en.blueprint.youtubeAnalyzer.connection.channelAvatar;
  fireEvent.error(await view.findByRole("img", { name: avatarName }));
  assert.ok(view.getByRole("img", { name: en.blueprint.youtubeAnalyzer.connection.channelAvatarUnavailable }));
  assert.equal(view.queryByRole("img", { name: avatarName }), null);
});

test("first synchronization exposes loading then completed and blocks double submit", async () => {
  let synchronizeCalls = 0;
  let resolveSynchronization!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => { resolveSynchronization = resolve; });
  const client = new YouTubeApiClient({
    fetch: createYouTubeFetch({
      channel: null,
      synchronize: () => {
        synchronizeCalls += 1;
        return pending;
      },
    }),
  });
  const hook = renderHook(() => useYouTubeConnection(client));
  await waitFor(() => assert.equal(hook.result.current.phase, "ready"));
  assert.equal(hook.result.current.channel?.title ?? null, null);

  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = hook.result.current.synchronize();
    second = hook.result.current.synchronize();
  });
  assert.equal(hook.result.current.operation, "synchronizing");
  assert.equal(synchronizeCalls, 1);
  resolveSynchronization(successResponse(completedResult));
  await act(async () => Promise.all([first, second]));
  assert.equal(hook.result.current.lastOutcome, "completed");
  assert.equal(hook.result.current.channel?.title, realChannel.title);
  hook.unmount();
});

test("no-change is modeled explicitly without fabricating changed fields", async () => {
  const client = new YouTubeApiClient({
    fetch: createYouTubeFetch({
      synchronize: () => successResponse({ channel: realChannel, synchronization: noChangeSync }),
    }),
  });
  const hook = renderHook(() => useYouTubeConnection(client));
  await waitFor(() => assert.equal(hook.result.current.phase, "ready"));
  await act(() => hook.result.current.synchronize());
  assert.equal(hook.result.current.lastOutcome, "no-change");
  assert.deepEqual(hook.result.current.lastSync?.changedFields, []);
  hook.unmount();
});

test("provider failure preserves the previous synchronized snapshot", async () => {
  const client = new YouTubeApiClient({
    fetch: createYouTubeFetch({ synchronize: () => errorResponse(502, "YOUTUBE_SYNC_FAILED") }),
  });
  const hook = renderHook(() => useYouTubeConnection(client));
  await waitFor(() => assert.equal(hook.result.current.channel?.title, realChannel.title));
  await act(() => hook.result.current.synchronize());
  assert.equal(hook.result.current.operationError, "provider");
  assert.equal(hook.result.current.channel?.title, realChannel.title);
  hook.unmount();
});

test("disconnect requires confirmation and updates the connection state", async () => {
  const client = new YouTubeApiClient({ fetch: createYouTubeFetch({ channel: { ...realChannel, thumbnailUrl: undefined } }) });
  const view = render(createElement(YouTubeConnectionExperience, { client, content: en.blueprint.youtubeAnalyzer.connection, locale: "en" }));
  await view.findByRole("heading", { name: realChannel.title });
  fireEvent.click(view.getByRole("button", { name: en.blueprint.youtubeAnalyzer.connection.disconnect }));
  assert.ok(view.getByRole("alertdialog", { name: en.blueprint.youtubeAnalyzer.connection.disconnectConfirmTitle }));
  fireEvent.click(view.getByRole("button", { name: en.blueprint.youtubeAnalyzer.connection.confirmDisconnect }));
  assert.ok(await view.findByRole("link", { name: en.blueprint.youtubeAnalyzer.connection.connect }));
});

test("unauthenticated response is converted to a safe sign-in state", async () => {
  const client = new YouTubeApiClient({ fetch: async () => errorResponse(401, "AUTHENTICATION_REQUIRED") });
  const view = render(createElement(YouTubeConnectionExperience, { client, content: en.blueprint.youtubeAnalyzer.connection, locale: "en" }));
  assert.ok(await view.findByRole("heading", { name: en.blueprint.youtubeAnalyzer.connection.authenticationTitle }));
  assert.equal(view.queryByText("AUTHENTICATION_REQUIRED"), null);
});

test("large counters use BigInt formatting without precision loss", () => {
  const formatted = formatYouTubeCounter("900719925474099312345", "en", "N/A");
  assert.equal(formatted.replaceAll(",", ""), "900719925474099312345");
});
