"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ChannelHistoryReadModel,
  ChannelTrendsReadModel,
  RealYouTubeIntelligenceReadModel,
  YouTubeVideoSynchronizationReadModel,
} from "../../../server/youtube/http-contracts";
import { YouTubeApiClientError } from "../../youtube-connection/client";
import {
  YouTubeVideoApiClient,
  type YouTubeClientErrorKind,
} from "../client";

export type RealAnalyzerState = Readonly<{
  phase: "loading" | "empty" | "success" | "error" | "unauthenticated";
  operation: "idle" | "synchronizing";
  intelligence: RealYouTubeIntelligenceReadModel | null;
  synchronization: YouTubeVideoSynchronizationReadModel | null;
  history: ChannelHistoryReadModel | null;
  trends: ChannelTrendsReadModel | null;
  error: YouTubeClientErrorKind | null;
  outcome: "completed" | "no-change" | "partial" | null;
}>;

const initialState: RealAnalyzerState = {
  phase: "loading",
  operation: "idle",
  intelligence: null,
  synchronization: null,
  history: null,
  trends: null,
  error: null,
  outcome: null,
};

export function useRealYouTubeAnalyzer(client: YouTubeVideoApiClient) {
  const [state, setState] = useState(initialState);
  const loadController = useRef<AbortController | null>(null);
  const synchronization = useRef<Promise<void> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setState((current) => ({ ...current, phase: "loading", error: null }));
    try {
      const [page, status, history, trends] = await Promise.all([
        client.list({ limit: 50 }, controller.signal),
        client.status(controller.signal),
        loadHistory(client, controller.signal),
        loadTrends(client, controller.signal),
      ]);
      if (page.videos.length === 0) {
        setState({
          ...initialState,
          phase: "empty",
          synchronization: status.lastSync,
          history,
          trends,
        });
        return;
      }
      const intelligence = await client.analyze(controller.signal);
      setState({
        phase: "success",
        operation: "idle",
        intelligence,
        synchronization: status.lastSync,
        history,
        trends,
        error: null,
        outcome: null,
      });
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.kind === "cancelled") return;
      setState((current) => ({
        ...current,
        phase:
          normalized.kind === "unauthenticated" ? "unauthenticated" : "error",
        operation: "idle",
        error: normalized.kind,
      }));
    }
  }, [client]);

  const synchronizeAndAnalyze = useCallback((): Promise<void> => {
    if (synchronization.current) return synchronization.current;
    const operation = (async () => {
      setState((current) => ({
        ...current,
        operation: "synchronizing",
        error: null,
        outcome: null,
      }));
      try {
        const synchronized = await client.synchronize();
        const [intelligence, history, trends] = await Promise.all([
          client.analyze(),
          loadHistory(client),
          loadTrends(client),
        ]);
        setState({
          phase: "success",
          operation: "idle",
          intelligence,
          synchronization: synchronized.synchronization,
          history,
          trends,
          error: null,
          outcome:
            synchronized.synchronization.outcome === "failed"
              ? null
              : synchronized.synchronization.outcome,
        });
      } catch (error) {
        const normalized = normalizeError(error);
        setState((current) => ({
          ...current,
          phase:
            normalized.kind === "unauthenticated"
              ? "unauthenticated"
              : current.intelligence
                ? "success"
                : "error",
          operation: "idle",
          error: normalized.kind,
          outcome: null,
        }));
      }
    })();
    synchronization.current = operation;
    void operation.finally(() => {
      synchronization.current = null;
    });
    return operation;
  }, [client]);

  useEffect(() => {
    void load();
    return () => loadController.current?.abort();
  }, [load]);

  return { ...state, reload: load, synchronizeAndAnalyze };
}

function normalizeError(error: unknown): YouTubeApiClientError {
  return error instanceof YouTubeApiClientError
    ? error
    : new YouTubeApiClientError("server", true);
}

function loadHistory(
  client: YouTubeVideoApiClient,
  signal?: AbortSignal,
): Promise<ChannelHistoryReadModel> {
  const candidate = client as Partial<Pick<YouTubeVideoApiClient, "history">>;
  return candidate.history
    ? candidate.history(signal)
    : Promise.resolve({ observations: [] });
}

function loadTrends(
  client: YouTubeVideoApiClient,
  signal?: AbortSignal,
): Promise<ChannelTrendsReadModel> {
  const candidate = client as Partial<Pick<YouTubeVideoApiClient, "trends">>;
  return candidate.trends
    ? candidate.trends("30d", signal)
    : Promise.resolve({
        period: "30d",
        freshness: { state: "unavailable", partialCoverage: false },
        trends: [],
      });
}
