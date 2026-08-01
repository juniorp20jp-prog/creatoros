"use client";

import { useCallback, useMemo } from "react";

import type {
  DeleteAnalysisRequest,
  DeleteAnalysisResponse,
} from "../../../server/analysis-api/contracts";
import type { AnalysisApiClient } from "../client";
import type { AnalysisMutationHookResult } from "./analysis-hook-state";
import { useAnalysisMutation } from "./use-analysis-mutation";

export type DeleteAnalysisMutationInput = {
  analysisRunId: string;
  request?: DeleteAnalysisRequest;
};

export function useDeleteAnalysis(
  client: AnalysisApiClient,
): AnalysisMutationHookResult<
  DeleteAnalysisMutationInput,
  DeleteAnalysisResponse
> {
  const mutate = useCallback(
    (input: DeleteAnalysisMutationInput, signal: AbortSignal) =>
      client.deleteAnalysis(
        input.analysisRunId,
        input.request,
        { signal },
      ),
    [client],
  );
  const options = useMemo(
    () => ({ mutate, isEmpty: () => false }),
    [mutate],
  );
  return useAnalysisMutation(options);
}
