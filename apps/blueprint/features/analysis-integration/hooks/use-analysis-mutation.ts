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
  type AnalysisMutationHookResult,
} from "./analysis-hook-state";

type UseAnalysisMutationOptions<TInput, TData> = {
  mutate(input: TInput, signal: AbortSignal): Promise<TData>;
  isEmpty(data: TData): boolean;
};

export function useAnalysisMutation<TInput, TData>(
  options: UseAnalysisMutationOptions<TInput, TData>,
): AnalysisMutationHookResult<TInput, TData> {
  const [state, setState] = useState<AnalysisHookState<TData>>(
    idleAnalysisState,
  );
  const lastInput = useRef<TInput | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  const run = useCallback(
    async (
      input: TInput,
      isRetry: boolean,
    ): Promise<TData | null> => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      lastInput.current = input;
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      setState({
        status: isRetry ? "retry" : "loading",
        data: null,
        error: null,
      });
      try {
        const data = await options.mutate(input, controller.signal);
        if (
          requestSequence.current !== sequence ||
          controller.signal.aborted
        ) {
          return null;
        }
        setState({
          status: options.isEmpty(data) ? "empty" : "success",
          data,
          error: null,
        });
        return data;
      } catch (error) {
        if (requestSequence.current !== sequence) {
          return null;
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
        return null;
      }
    },
    [options],
  );

  const execute = useCallback(
    (input: TInput) => run(input, false),
    [run],
  );

  const retry = useCallback(() => {
    const input = lastInput.current;
    return input === null
      ? Promise.resolve(null)
      : run(input, true);
  }, [run]);

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

  useEffect(
    () => () => {
      activeController.current?.abort();
      requestSequence.current += 1;
    },
    [],
  );

  return { ...state, execute, retry, cancel };
}
