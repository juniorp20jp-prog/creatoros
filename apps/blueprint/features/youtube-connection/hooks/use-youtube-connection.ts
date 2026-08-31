"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  YouTubeChannelReadModel,
  YouTubeConnectionReadModel,
  YouTubeSynchronizationReadModel,
} from "../../../server/youtube/http-contracts";
import {
  YouTubeApiClient,
  YouTubeApiClientError,
  type YouTubeClientErrorKind,
} from "../client";

export type YouTubeConnectionPhase =
  | "loading"
  | "ready"
  | "unauthenticated"
  | "error";

export type YouTubeOperation = "idle" | "synchronizing" | "disconnecting";

export type YouTubeConnectionControllerState = Readonly<{
  phase: YouTubeConnectionPhase;
  connection: YouTubeConnectionReadModel | null;
  channel: YouTubeChannelReadModel | null;
  lastSync: YouTubeSynchronizationReadModel | null;
  operation: YouTubeOperation;
  lastOutcome: "completed" | "no-change" | null;
  loadError: YouTubeClientErrorKind | null;
  operationError: YouTubeClientErrorKind | null;
}>;

const initialState: YouTubeConnectionControllerState = {
  phase: "loading",
  connection: null,
  channel: null,
  lastSync: null,
  operation: "idle",
  lastOutcome: null,
  loadError: null,
  operationError: null,
};

export function useYouTubeConnection(client: YouTubeApiClient) {
  const [state, setState] = useState(initialState);
  const loadController = useRef<AbortController | null>(null);
  const synchronization = useRef<Promise<void> | null>(null);
  const disconnection = useRef<Promise<void> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setState((current) => ({ ...current, phase: "loading", loadError: null }));
    try {
      const connection = await client.getConnectionStatus(controller.signal);
      if (!connection.connected) {
        setState({
          ...initialState,
          phase: "ready",
          connection,
        });
        return;
      }
      const [channel, synchronizationStatus] = await Promise.all([
        client.getChannel(controller.signal),
        client.getSynchronizationStatus(controller.signal),
      ]);
      setState({
        phase: "ready",
        connection,
        channel,
        lastSync: synchronizationStatus.lastSync,
        operation: "idle",
        lastOutcome: null,
        loadError: null,
        operationError: null,
      });
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.kind === "cancelled") return;
      setState((current) => ({
        ...current,
        phase: normalized.kind === "unauthenticated" ? "unauthenticated" : "error",
        loadError: normalized.kind,
      }));
    }
  }, [client]);

  const synchronize = useCallback((): Promise<void> => {
    if (synchronization.current) return synchronization.current;
    const operation = (async () => {
      setState((current) => ({
        ...current,
        operation: "synchronizing",
        lastOutcome: null,
        operationError: null,
      }));
      try {
        const result = await client.synchronize();
        setState((current) => ({
          ...current,
          phase: "ready",
          channel: result.channel,
          lastSync: result.synchronization,
          operation: "idle",
          lastOutcome: result.synchronization.outcome === "no-change" ? "no-change" : "completed",
          operationError: null,
        }));
      } catch (error) {
        const normalized = normalizeError(error);
        setState((current) => ({
          ...current,
          phase: normalized.kind === "unauthenticated" ? "unauthenticated" : current.phase,
          operation: "idle",
          operationError: normalized.kind,
        }));
      }
    })();
    synchronization.current = operation;
    void operation.finally(() => {
      synchronization.current = null;
    });
    return operation;
  }, [client]);

  const disconnect = useCallback((): Promise<void> => {
    if (disconnection.current) return disconnection.current;
    const operation = (async () => {
      setState((current) => ({
        ...current,
        operation: "disconnecting",
        lastOutcome: null,
        operationError: null,
      }));
      try {
        const connection = await client.disconnect();
        setState({
          ...initialState,
          phase: "ready",
          connection,
        });
      } catch (error) {
        const normalized = normalizeError(error);
        setState((current) => ({
          ...current,
          phase: normalized.kind === "unauthenticated" ? "unauthenticated" : current.phase,
          operation: "idle",
          operationError: normalized.kind,
        }));
      }
    })();
    disconnection.current = operation;
    void operation.finally(() => {
      disconnection.current = null;
    });
    return operation;
  }, [client]);

  useEffect(() => {
    void load();
    return () => loadController.current?.abort();
  }, [load]);

  return {
    ...state,
    reload: load,
    synchronize,
    disconnect,
  };
}

function normalizeError(error: unknown): YouTubeApiClientError {
  return error instanceof YouTubeApiClientError
    ? error
    : new YouTubeApiClientError("server", true);
}
