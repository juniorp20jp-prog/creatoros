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
  const analysisId = query?.analysisId;
  const attempt = query?.attempt;
  const channelId = query?.channelId;
  const creatorId = query?.creatorId;
  const from = query?.from;
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
          }
        : undefined,
    [
      analysisId,
      attempt,
      channelId,
      creatorId,
      from,
      status,
      to,
    ],
  );
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!stableQuery) {
        throw new Error("Analysis status query is unavailable.");
      }
      return client.getStatusSummary(stableQuery, { signal });
    },
    [client, stableQuery],
  );
  const options = useMemo(
    () => ({
      enabled: Boolean(stableQuery?.channelId.trim()),
      load,
      isEmpty: (data: AnalysisStatusSummary) => data.total === 0,
    }),
    [load, stableQuery],
  );
  return useAnalysisQueryResource(options);
}
