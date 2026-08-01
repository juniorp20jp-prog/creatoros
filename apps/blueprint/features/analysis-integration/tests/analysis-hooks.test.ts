import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { act, renderHook, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";

import { AnalysisApiClient } from "../client";
import {
  useAnalysis,
  useAnalysisHistory,
  useAnalysisList,
  useDeleteAnalysis,
  useReplay,
  useStatusSummary,
} from "../hooks";
import {
  abortableFetch,
  analysisDetails,
  analysisHistory,
  deferred,
  emptyAnalysisPage,
  errorResponse,
  statusSummary,
  successResponse,
} from "./frontend-test-fixtures";

let dom: JSDOM;

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
    MutationObserver: {
      configurable: true,
      value: dom.window.MutationObserver,
    },
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
    "IS_REACT_ACT_ENVIRONMENT",
  ]) {
    Reflect.deleteProperty(globalThis, name);
  }
});

test("useAnalysis supports idle, loading, and success", async () => {
  const pending = deferred<Response>();
  const client = new AnalysisApiClient({ fetch: abortableFetch(pending) });
  const idle = renderHook(() => useAnalysis(client));
  assert.equal(idle.result.current.status, "idle");
  idle.unmount();

  const hook = renderHook(() =>
    useAnalysis(client, "analysis_run_frontend"),
  );
  assert.equal(hook.result.current.status, "loading");
  await act(async () => {
    pending.resolve(successResponse(analysisDetails));
    await pending.promise;
  });
  await waitFor(() => {
    assert.equal(hook.result.current.status, "success");
  });
  assert.equal(
    hook.result.current.data?.summary.analysisRunId,
    "analysis_run_frontend",
  );
  hook.unmount();
});

test("useAnalysisList and useStatusSummary expose empty state", async () => {
  const responses = [
    successResponse(emptyAnalysisPage),
    successResponse({
      ...statusSummary,
      total: 0,
      counts: {
        pending: 0,
        processing: 0,
        completed: 0,
        partial: 0,
        failed: 0,
      },
    }),
  ];
  const client = new AnalysisApiClient({
    fetch: async () => responses.shift()!,
  });
  const list = renderHook(() =>
    useAnalysisList(client, {
      channelId: "channel_fixture_complete",
    }),
  );
  await waitFor(() => assert.equal(list.result.current.status, "empty"));
  assert.deepEqual(list.result.current.data?.items, []);
  list.unmount();

  const summary = renderHook(() =>
    useStatusSummary(client, {
      channelId: "channel_fixture_complete",
    }),
  );
  await waitFor(() =>
    assert.equal(summary.result.current.status, "empty"),
  );
  summary.unmount();
});

test("useAnalysisHistory returns history through mock HTTP", async () => {
  const client = new AnalysisApiClient({
    fetch: async () => successResponse(analysisHistory),
  });
  const hook = renderHook(() =>
    useAnalysisHistory(client, "analysis_run_frontend"),
  );
  await waitFor(() => assert.equal(hook.result.current.status, "success"));
  assert.equal(hook.result.current.data?.items.length, 1);
  hook.unmount();
});

test("query hooks expose safe errors and retry a failed HTTP request", async () => {
  let callCount = 0;
  const client = new AnalysisApiClient({
    fetch: async () => {
      callCount += 1;
      return callCount === 1
        ? errorResponse(500)
        : successResponse(analysisDetails);
    },
  });
  const hook = renderHook(() =>
    useAnalysis(client, "analysis_run_frontend"),
  );
  await waitFor(() => assert.equal(hook.result.current.status, "error"));
  assert.equal(hook.result.current.error?.kind, "server");
  assert.equal(hook.result.current.error?.retryable, true);
  assert.equal("code" in hook.result.current.error!, false);

  act(() => hook.result.current.retry());
  assert.equal(hook.result.current.status, "retry");
  await waitFor(() => assert.equal(hook.result.current.status, "success"));
  assert.equal(callCount, 2);
  hook.unmount();
});

test("query hooks cancel an in-flight HTTP request", async () => {
  const pending = deferred<Response>();
  const client = new AnalysisApiClient({ fetch: abortableFetch(pending) });
  const hook = renderHook(() =>
    useAnalysis(client, "analysis_run_frontend"),
  );
  assert.equal(hook.result.current.status, "loading");
  act(() => hook.result.current.cancel());
  assert.equal(hook.result.current.status, "cancelled");
  assert.equal(hook.result.current.error?.kind, "cancelled");
  hook.unmount();
});

test("useReplay supports loading, success, and retry", async () => {
  let callCount = 0;
  const client = new AnalysisApiClient({
    fetch: async () => {
      callCount += 1;
      return callCount === 1
        ? errorResponse(500)
        : successResponse({
            analysisRunId: "analysis_run_replay",
            replayedFromAnalysisRunId: "analysis_run_frontend",
            analysis: analysisDetails,
          });
    },
  });
  const hook = renderHook(() => useReplay(client));
  await act(async () => {
    await hook.result.current.execute({
      analysisRunId: "analysis_run_frontend",
      request: { fixtureId: "complete" },
    });
  });
  assert.equal(hook.result.current.status, "error");

  let retryPromise!: Promise<unknown>;
  act(() => {
    retryPromise = hook.result.current.retry();
  });
  assert.equal(hook.result.current.status, "retry");
  await act(async () => {
    await retryPromise;
  });
  assert.equal(hook.result.current.status, "success");
  assert.equal(hook.result.current.data?.analysisRunId, "analysis_run_replay");
  hook.unmount();
});

test("useDeleteAnalysis sends expectedRevision and can cancel", async () => {
  const pending = deferred<Response>();
  let requestedUrl = "";
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    return abortableFetch(pending)(input, init);
  };
  const client = new AnalysisApiClient({ fetch: fetchMock });
  const hook = renderHook(() => useDeleteAnalysis(client));
  act(() => {
    void hook.result.current.execute({
      analysisRunId: "analysis_run_frontend",
      request: { expectedRevision: 3 },
    });
  });
  assert.equal(hook.result.current.status, "loading");
  assert.match(requestedUrl, /expectedRevision=3/);
  act(() => hook.result.current.cancel());
  assert.equal(hook.result.current.status, "cancelled");
  hook.unmount();
});
