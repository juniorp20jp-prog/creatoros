"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { normalizeAnalysisClientError } from "../client";
import {
  idleAnalysisState,
  type AnalysisHookState,
  type AnalysisQueryHookResult,
} from "./analysis-hook-state";

type UseAnalysisQueryResourceOptions<TData> = {
  enabled: boolean;
  load(signal: AbortSignal): Promise<TData>;
  isEmpty(data: TData): boolean;
};

export function useAnalysisQueryResource<TData>(
  options: UseAnalysisQueryResourceOptions<TData>,
): AnalysisQueryHookResult<TData> {
  const [state, setState] = useState<AnalysisHookState<TData>>(
    idleAnalysisState,
  );
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const load = useCallback(
    async (isRetry: boolean): Promise<void> => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      setState({
        status: isRetry ? "retry" : "loading",
        data: null,
        error: null,
      });
      try {
        const data = await options.load(controller.signal);
        if (
          requestSequence.current !== sequence ||
          controller.signal.aborted
        ) {
          return;
        }
        setState({
          status: options.isEmpty(data) ? "empty" : "success",
          data,
          error: null,
        });
      } catch (error) {
        if (requestSequence.current !== sequence) {
          return;
        }
        const normalized = normalizeAnalysisClientError(error);
        setState({
          status:
            normalized.kind === "cancelled"
              ? "cancelled"
              : "error",
          data: null,
          error: normalized,
        });
      }
    },
    [options],
  );

  useEffect(() => {
    if (!options.enabled) {
      activeController.current?.abort();
      requestSequence.current += 1;
      setState(idleAnalysisState());
      return;
    }
    void load(false);
    return () => {
      activeController.current?.abort();
      requestSequence.current += 1;
    };
  }, [load, options.enabled]);

  const retry = useCallback(() => {
    if (options.enabled) {
      void load(true);
    }
  }, [load, options.enabled]);

  const cancel = useCallback(() => {
    if (!activeController.current) {
      return;
    }
    activeController.current.abort();
    activeController.current = null;
    requestSequence.current += 1;
    setState({
      status: "cancelled",
      data: null,
      error: normalizeAnalysisClientError(
        new DOMException("Request cancelled.", "AbortError"),
      ),
    });
  }, []);

  return { ...state, retry, cancel };
}
