"use client";

import { useCallback, useMemo } from "react";
import type {
  AnalysisSummary,
  ListAnalysisRunsRequest,
  PaginationResult,
} from "../../../server/analysis-api/contracts";
import type { AnalysisApiClient } from "../client";
import type { AnalysisQueryHookResult } from "./analysis-hook-state";
import { useAnalysisQueryResource } from "./use-analysis-query-resource";

export function useAnalysisList(
  client: AnalysisApiClient,
  query?: ListAnalysisRunsRequest,
): AnalysisQueryHookResult<PaginationResult<AnalysisSummary>> {
  const serialized = query ? JSON.stringify(query) : undefined;
  const stableQuery = useMemo(
    () => serialized ? JSON.parse(serialized) as ListAnalysisRunsRequest : undefined,
    [serialized],
  );
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!stableQuery) throw new Error("Analysis list query is unavailable.");
      return client.listAnalysisRuns(stableQuery, { signal });
    },
    [client, stableQuery],
  );
  const options = useMemo(
    () => ({
      enabled: stableQuery !== undefined,
      load,
      isEmpty: (data: PaginationResult<AnalysisSummary>) => data.items.length === 0,
    }),
    [load, stableQuery],
  );
  return useAnalysisQueryResource(options);
}