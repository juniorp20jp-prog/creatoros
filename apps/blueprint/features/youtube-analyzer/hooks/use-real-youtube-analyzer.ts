"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
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
  error: YouTubeClientErrorKind | null;
  outcome: "completed" | "no-change" | "partial" | null;
}>;

const initialState: RealAnalyzerState = {
  phase: "loading",
  operation: "idle",
  intelligence: null,
  synchronization: null,
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
      const [page, status] = await Promise.all([
        client.list({ limit: 50 }, controller.signal),
        client.status(controller.signal),
      ]);
      if (page.videos.length === 0) {
        setState({
          ...initialState,
          phase: "empty",
          synchronization: status.lastSync,
        });
        return;
      }
      const intelligence = await client.analyze(controller.signal);
      setState({
        phase: "success",
        operation: "idle",
        intelligence,
        synchronization: status.lastSync,
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
        const intelligence = await client.analyze();
        setState({
          phase: "success",
          operation: "idle",
          intelligence,
          synchronization: synchronized.synchronization,
          error: null,
          outcome: synchronized.synchronization.outcome === "failed"
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
