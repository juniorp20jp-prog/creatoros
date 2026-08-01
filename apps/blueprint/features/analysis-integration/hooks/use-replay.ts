"use client";

import { useCallback, useMemo } from "react";

import type {
  ReplayAnalysisRequest,
  ReplayAnalysisResponse,
} from "../../../server/analysis-api/contracts";
import type { AnalysisApiClient } from "../client";
import type { AnalysisMutationHookResult } from "./analysis-hook-state";
import { useAnalysisMutation } from "./use-analysis-mutation";

export type ReplayAnalysisMutationInput = {
  analysisRunId: string;
  request: ReplayAnalysisRequest;
};

export function useReplay(
  client: AnalysisApiClient,
): AnalysisMutationHookResult<
  ReplayAnalysisMutationInput,
  ReplayAnalysisResponse
> {
  const mutate = useCallback(
    (input: ReplayAnalysisMutationInput, signal: AbortSignal) =>
      client.replayAnalysis(input.analysisRunId, input.request, {
        signal,
      }),
    [client],
  );
  const options = useMemo(
    () => ({ mutate, isEmpty: () => false }),
    [mutate],
  );
  return useAnalysisMutation(options);
}
