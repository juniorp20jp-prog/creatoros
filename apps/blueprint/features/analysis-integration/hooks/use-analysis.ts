"use client";

import { useCallback, useMemo } from "react";

import type { AnalysisDetails } from "../../../server/analysis-api/contracts";
import type { AnalysisApiClient } from "../client";
import type { AnalysisQueryHookResult } from "./analysis-hook-state";
import { useAnalysisQueryResource } from "./use-analysis-query-resource";

export function useAnalysis(
  client: AnalysisApiClient,
  analysisRunId?: string,
): AnalysisQueryHookResult<AnalysisDetails> {
  const normalizedId = analysisRunId?.trim() ?? "";
  const load = useCallback(
    (signal: AbortSignal) =>
      client.getAnalysis(normalizedId, { signal }),
    [client, normalizedId],
  );
  const options = useMemo(
    () => ({
      enabled: normalizedId.length > 0,
      load,
      isEmpty: () => false,
    }),
    [load, normalizedId],
  );
  return useAnalysisQueryResource(options);
}
