"use client";

import { useCallback, useMemo } from "react";

import type { AnalysisHistory } from "../../../server/analysis-api/contracts";
import type { AnalysisApiClient } from "../client";
import type { AnalysisQueryHookResult } from "./analysis-hook-state";
import { useAnalysisQueryResource } from "./use-analysis-query-resource";

export function useAnalysisHistory(
  client: AnalysisApiClient,
  analysisRunId?: string,
): AnalysisQueryHookResult<AnalysisHistory> {
  const normalizedId = analysisRunId?.trim() ?? "";
  const load = useCallback(
    (signal: AbortSignal) =>
      client.getAnalysisHistory(normalizedId, { signal }),
    [client, normalizedId],
  );
  const options = useMemo(
    () => ({
      enabled: normalizedId.length > 0,
      load,
      isEmpty: (data: AnalysisHistory) => data.items.length === 0,
    }),
    [load, normalizedId],
  );
  return useAnalysisQueryResource(options);
}
