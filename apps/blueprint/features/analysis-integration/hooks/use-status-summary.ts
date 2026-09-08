"use client";

import { useCallback, useMemo } from "react";
import type {
  AnalysisStatusSummary,
  StatusSummaryRequest,
} from "../../../server/analysis-api/contracts";
import type { AnalysisApiClient } from "../client";
import type { AnalysisQueryHookResult } from "./analysis-hook-state";
import { useAnalysisQueryResource } from "./use-analysis-query-resource";

export function useStatusSummary(
  client: AnalysisApiClient,
  query?: StatusSummaryRequest,
): AnalysisQueryHookResult<AnalysisStatusSummary> {
  const serialized = query ? JSON.stringify(query) : undefined;
  const stableQuery = useMemo(
    () => serialized ? JSON.parse(serialized) as StatusSummaryRequest : undefined,
    [serialized],
  );
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!stableQuery) throw new Error("Analysis status query is unavailable.");
      return client.getStatusSummary(stableQuery, { signal });
    },
    [client, stableQuery],
  );
  const options = useMemo(
    () => ({
      enabled: stableQuery !== undefined,
      load,
      isEmpty: (data: AnalysisStatusSummary) => data.total === 0,
    }),
    [load, stableQuery],
  );
  return useAnalysisQueryResource(options);
}