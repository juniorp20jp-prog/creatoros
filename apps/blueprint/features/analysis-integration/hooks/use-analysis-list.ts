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
  const analysisId = query?.analysisId;
  const attempt = query?.attempt;
  const channelId = query?.channelId;
  const creatorId = query?.creatorId;
  const cursor = query?.cursor;
  const from = query?.from;
  const limit = query?.limit;
  const status = query?.status;
  const to = query?.to;
  const stableQuery = useMemo(
    () =>
      channelId !== undefined
        ? {
            channelId,
            ...(creatorId ? { creatorId } : {}),
            ...(status ? { status } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(attempt !== undefined ? { attempt } : {}),
            ...(analysisId ? { analysisId } : {}),
            ...(cursor ? { cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
          }
        : undefined,
    [
      analysisId,
      attempt,
      channelId,
      creatorId,
      cursor,
      from,
      limit,
      status,
      to,
    ],
  );
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!stableQuery) {
        throw new Error("Analysis list query is unavailable.");
      }
      return client.listAnalysisRuns(stableQuery, { signal });
    },
    [client, stableQuery],
  );
  const options = useMemo(
    () => ({
      enabled: Boolean(stableQuery?.channelId.trim()),
      load,
      isEmpty: (data: PaginationResult<AnalysisSummary>) =>
        data.items.length === 0,
    }),
    [load, stableQuery],
  );
  return useAnalysisQueryResource(options);
}
