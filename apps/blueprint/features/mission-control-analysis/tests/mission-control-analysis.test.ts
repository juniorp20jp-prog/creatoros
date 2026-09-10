import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { createElement } from "react";

import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { JSDOM } from "jsdom";

import en from "../../../messages/en.json";
import { AnalysisApiClient } from "../../analysis-integration";
import { YouTubeApiClient } from "../../youtube-connection";
import { MissionControlAnalysisExperience } from "../MissionControlAnalysisExperience";
import {
  errorResponse,
  missionDetails,
  missionHistory,
  missionPage,
  missionStatusSummary,
  successResponse,
} from "./mission-control-test-fixtures";

let dom: JSDOM;

before(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3002/en/mission-control",
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
    confirm: {
      configurable: true,
      value: () => true,
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
    "confirm",
  ]) {
    Reflect.deleteProperty(globalThis, name);
  }
});

afterEach(() => {
  cleanup();
  globalThis.confirm = () => true;
});

test("renders initial loading, status summary, list, and accessible structure", async () => {
  const requests: string[] = [];
  const client = new AnalysisApiClient({
    fetch: createMissionFetch(requests),
  });
  const view = renderMissionControl(client);

  assert.ok(view.getAllByRole("status").length >= 2);
  assert.equal(view.getByRole("heading", { level: 1 }).textContent, "Mission Control");
  assert.ok(view.getByRole("button", { name: "Run analysis" }));

  await view.findByRole("table", { name: "Recent analysis runs" });
  assert.ok(view.getAllByText("Completed").length >= 1);
  assert.equal(view.queryByText("CreatorOS Demo Channel"), null);
  assert.equal(view.getByText("Total: 5").textContent, "Total: 5");
  assert.ok(view.getByRole("navigation", { name: "Analysis pagination" }));
  assert.ok(requests.some((url) => url.includes("status-summary")));
  view.unmount();
});

test("covers empty, safe error, and retry states", async () => {
  let summaryCalls = 0;
  const client = new AnalysisApiClient({
    fetch: async (input) => {
      const url = String(input);
      if (url.includes("status-summary")) {
        summaryCalls += 1;
        return summaryCalls === 1
          ? errorResponse(500)
          : successResponse({
              ...missionStatusSummary,
              total: 0,
              counts: {
                completed: 0,
                partial: 0,
                failed: 0,
                processing: 0,
                pending: 0,
              },
            });
      }
      return successResponse(missionPage({ items: [] }));
    },
  });
  const view = renderMissionControl(client);
  await view.findByText("CreatorOS could not complete the request.");
  assert.ok(view.getByText("There are no analyses yet. Run the first one to begin."));
  fireEvent.click(view.getByRole("button", { name: "Try again" }));
  await view.findByText("Total: 0");
  assert.equal(summaryCalls, 2);
  view.unmount();
});

test("selects details, shows insufficient scores, and reads official history", async () => {
  const client = new AnalysisApiClient({ fetch: createMissionFetch([]) });
  const view = renderMissionControl(client);
  await view.findByRole("table");
  fireEvent.click(view.getAllByRole("button", { name: "Details" })[0]!);
  await view.findByText("CreatorOS Demo Channel");
  assert.ok(view.getByText("Insufficient data"));
  assert.ok(view.getByText("Stabilize publishing cadence"));
  assert.ok(view.getByText("Define a repeatable publishing cadence"));
  assert.ok(view.getByText("This version uses deterministic analysis without external providers."));

  fireEvent.click(view.getByRole("tab", { name: "History" }));
  await view.findByText("Run history");
  assert.ok(view.getByText("Original run"));
  assert.ok(view.getAllByText("Replay").length >= 1);
  assert.ok(view.getByText(/Correlation:/));
  view.unmount();
});

test("runs, confirms replay, reports concurrency conflict, and deletes safely", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  let deleteCalls = 0;
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ url, method });
    if (method === "POST" && url.endsWith("/analysis-runs")) {
      return successResponse(
        {
          analysisRunId: "analysis_run_new",
          analysis: missionDetails,
        },
        201,
      );
    }
    if (method === "POST" && url.endsWith("/replay")) {
      return successResponse({
        analysisRunId: "analysis_run_replay",
        replayedFromAnalysisRunId: missionDetails.summary.analysisRunId,
        analysis: missionDetails,
      });
    }
    if (method === "DELETE") {
      deleteCalls += 1;
      return deleteCalls === 1
        ? errorResponse(409)
        : successResponse({
            analysisRunId: missionDetails.summary.analysisRunId,
            deleted: true,
            revision: 3,
          });
    }
    return routeReadRequest(url);
  };
  const client = new AnalysisApiClient({ fetch: fetchMock });
  const view = renderMissionControl(client);
  await view.findByRole("table");

  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Run analysis" }));
  });
  await view.findByText("Analysis completed and the workspace was refreshed.");
  assert.equal(
    requests.filter(({ url, method }) =>
      method === "POST" && url.endsWith("/analysis-runs"),
    ).length,
    1,
  );

  fireEvent.click(view.getAllByRole("button", { name: "Details" })[0]!);
  await view.findByText("CreatorOS Demo Channel");
  fireEvent.click(view.getAllByRole("button", { name: "Replay" }).at(-1)!);
  await view.findByText("Replay created successfully; the original remains unchanged.");
  assert.ok(requests.some(({ url, method }) => method === "POST" && url.endsWith("/replay")));

  fireEvent.click(view.getAllByRole("button", { name: "Delete" }).at(-1)!);
  await view.findByText("The analysis changed before this action completed. Refresh and try again.");
  assert.doesNotMatch(document.body.textContent ?? "", /INTERNAL_CODE_MUST_NOT_ESCAPE|Private transport message/);

  fireEvent.click(view.getAllByRole("button", { name: "Delete" }).at(-1)!);
  await view.findByText("The analysis was deleted.");
  await waitFor(() => {
    assert.ok(view.getByText("Select an analysis to view its details and history."));
  });
  view.unmount();
});

test("uses opaque cursor pagination and respects cancelled confirmations", async () => {
  const requests: string[] = [];
  const client = new AnalysisApiClient({
    fetch: async (input, init) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("status-summary")) {
        return successResponse(missionStatusSummary);
      }
      if (url.includes("cursor=opaque-next")) {
        return successResponse(missionPage());
      }
      if (url.includes("/history")) {
        return successResponse(missionHistory);
      }
      if (/analysis-runs\/[^?]+$/.test(url)) {
        return successResponse(missionDetails);
      }
      if (init?.method === "POST" || init?.method === "DELETE") {
        throw new Error("Confirmation should prevent this request.");
      }
      return successResponse(missionPage({ nextCursor: "opaque-next" }));
    },
  });
  globalThis.confirm = () => false;
  const view = renderMissionControl(client);
  await view.findByRole("table");
  fireEvent.click(view.getByRole("button", { name: "Next" }));
  await waitFor(() => {
    assert.ok(requests.some((url) => url.includes("cursor=opaque-next")));
  });
  fireEvent.click(view.getByRole("button", { name: "Previous" }));
  await waitFor(() => {
    const firstPageRequests = requests.filter((url) =>
      url.includes("analysis-runs?") && !url.includes("cursor="),
    );
    assert.ok(firstPageRequests.length >= 2);
  });
  await act(async () => {
    fireEvent.click(view.getAllByRole("button", { name: "Replay" })[0]!);
    fireEvent.click(view.getAllByRole("button", { name: "Delete" })[0]!);
    await Promise.resolve();
  });
  assert.equal(requests.filter((url) => url.endsWith("/replay")).length, 0);
  globalThis.confirm = () => true;
  view.unmount();
});

function createMissionFetch(requests: string[]): typeof globalThis.fetch {
  return async (input) => {
    const url = String(input);
    requests.push(url);
    return routeReadRequest(url);
  };
}

function renderMissionControl(client: AnalysisApiClient) {
  const youtubeClient = new YouTubeApiClient({
    fetch: async () => Response.json({ data: { connected: false, scopes: [] } }),
  });
  return render(
    createElement(MissionControlAnalysisExperience, {
      client,
      content: en.blueprint.missionControl,
      locale: "en",
      youtubeClient,
    }),
  );
}

function routeReadRequest(url: string): Response {
  if (url.includes("status-summary")) {
    return successResponse(missionStatusSummary);
  }
  if (url.endsWith("/history")) {
    return successResponse(missionHistory);
  }
  if (/analysis-runs\/[^?]+$/.test(url)) {
    return successResponse(missionDetails);
  }
  return successResponse(missionPage());
}
