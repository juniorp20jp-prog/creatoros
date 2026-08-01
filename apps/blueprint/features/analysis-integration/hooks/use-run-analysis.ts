"use client";

import { useCallback, useMemo } from "react";

import type {
  RunAnalysisRequest,
  RunAnalysisResponse,
} from "../../../server/analysis-api/contracts";
import type { AnalysisApiClient } from "../client";
import type { AnalysisMutationHookResult } from "./analysis-hook-state";
import { useAnalysisMutation } from "./use-analysis-mutation";

export function useRunAnalysis(
  client: AnalysisApiClient,
): AnalysisMutationHookResult<
  RunAnalysisRequest,
  RunAnalysisResponse
> {
  const mutate = useCallback(
    (input: RunAnalysisRequest, signal: AbortSignal) =>
      client.runAnalysis(input, { signal }),
    [client],
  );
  const options = useMemo(
    () => ({ mutate, isEmpty: () => false }),
    [mutate],
  );
  return useAnalysisMutation(options);
}
