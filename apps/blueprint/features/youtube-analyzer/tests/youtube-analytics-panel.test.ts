import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import * as React from "react";

import { fireEvent, render } from "@testing-library/react";
import { JSDOM } from "jsdom";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBr from "../../../messages/pt-BR.json";
import { YouTubeAnalyticsPanel } from "../components/YouTubeAnalyticsPanel";

let dom: JSDOM;
const content = en.blueprint.youtubeAnalyzer.realAnalyzer.analytics;
const base = {
  content,
  locale: "en" as const,
  period: "30d" as const,
  synchronizing: false,
  error: false,
  onPeriodChange: () => undefined,
  onSynchronize: () => undefined,
};

before(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3002" });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    Node: { configurable: true, value: dom.window.Node },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver },
    React: { configurable: true, value: React },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
  });
});

after(() => {
  dom.window.close();
  for (const name of ["window", "document", "navigator", "HTMLElement", "Node", "MutationObserver", "React", "IS_REACT_ACT_ENVIRONMENT"]) Reflect.deleteProperty(globalThis, name);
});

test("Analytics panel keeps the optional connect state explicit when not authorized or declined", () => {
  const view = render(React.createElement(YouTubeAnalyticsPanel, { ...base, status: { state: "not-authorized", updatedAt: "2026-09-12T00:00:00.000Z" }, analytics: null }));
  assert.ok(view.getByRole("button", { name: content.connect }));
  assert.ok(view.getByRole("status").textContent?.includes(content.optional));
  view.rerender(React.createElement(YouTubeAnalyticsPanel, { ...base, status: { state: "declined", updatedAt: "2026-09-12T00:00:00.000Z" }, analytics: null }));
  assert.ok(view.getByRole("status").textContent?.includes(content.declined));
  view.unmount();
});

test("authorized Analytics renders real metrics, bounded periods, loading, and accessible actions", () => {
  const periods: string[] = [];
  let synchronizeCount = 0;
  const view = render(React.createElement(YouTubeAnalyticsPanel, {
    ...base,
    status: { state: "authorized", authorizedAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z" },
    analytics: { period: "30d", requestedStartDate: "2026-08-14", requestedEndDate: "2026-09-12", effectiveDataThrough: "2026-09-10", availability: "partial", freshness: "processing", values: { estimatedMinutesWatched: "120.5", averageViewDuration: "42.25", averageViewPercentage: "55.5", subscribersGained: "4", subscribersLost: "1", netSubscribers: "3" }, availableFields: ["estimatedMinutesWatched", "averageViewDuration", "averageViewPercentage", "subscribersGained", "subscribersLost", "netSubscribers"], missingFields: [], channelDays: 2, videoCount: 1 },
    onPeriodChange: (period) => periods.push(period),
    onSynchronize: () => { synchronizeCount += 1; },
  }));
  assert.ok(view.getByText("120.5"));
  assert.ok(view.getByText("55.5"));
  fireEvent.change(view.getByRole("combobox"), { target: { value: "7d" } });
  fireEvent.click(view.getByRole("button", { name: content.sync }));
  assert.deepEqual(periods, ["7d"]);
  assert.equal(synchronizeCount, 1);
  view.rerender(React.createElement(YouTubeAnalyticsPanel, { ...base, status: { state: "authorized", updatedAt: "2026-09-12T00:00:00.000Z" }, analytics: null, synchronizing: true }));
  assert.equal(view.getByRole("button", { name: content.synchronizing }).getAttribute("aria-busy"), "true");
  view.unmount();
});

test("Analytics panel distinguishes no-data and safe provider error in all locale dictionaries", () => {
  const view = render(React.createElement(YouTubeAnalyticsPanel, {
    ...base,
    status: { state: "authorized", updatedAt: "2026-09-12T00:00:00.000Z" },
    analytics: { period: "30d", requestedStartDate: "2026-08-14", requestedEndDate: "2026-09-12", availability: "no-data", freshness: "unavailable", values: {}, availableFields: [], missingFields: [], channelDays: 0, videoCount: 0 },
    error: true,
  }));
  assert.ok(view.getByText(content.noData));
  assert.equal(view.getByRole("alert").textContent, content.error);
  view.unmount();
  for (const dictionary of [en, es, fr, ptBr]) {
    const analytics = dictionary.blueprint.youtubeAnalyzer.realAnalyzer.analytics;
    for (const key of ["title", "connect", "notAuthorized", "declined", "unavailable", "noData", "error", "watchTime", "averageViewDuration", "averagePercentageViewed", "subscribersGained", "subscribersLost", "netSubscribers", "effectiveThrough"]) {
      assert.equal(typeof analytics[key as keyof typeof analytics], "string");
    }
  }
});
