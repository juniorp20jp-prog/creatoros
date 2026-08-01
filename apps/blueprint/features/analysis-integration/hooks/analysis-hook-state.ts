import type { AnalysisApiClientError } from "../client";

export type AnalysisHookStatus =
  | "idle"
  | "loading"
  | "retry"
  | "success"
  | "empty"
  | "error"
  | "cancelled";

export type AnalysisHookState<TData> = {
  status: AnalysisHookStatus;
  data: TData | null;
  error: AnalysisApiClientError | null;
};

export type AnalysisQueryHookResult<TData> =
  AnalysisHookState<TData> & {
    retry(): void;
    cancel(): void;
  };

export type AnalysisMutationHookResult<TInput, TData> =
  AnalysisHookState<TData> & {
    execute(input: TInput): Promise<TData | null>;
    retry(): Promise<TData | null>;
    cancel(): void;
  };

export function idleAnalysisState<TData>(): AnalysisHookState<TData> {
  return { status: "idle", data: null, error: null };
}
