import type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisStatusSummary,
  AnalysisSummary,
  DeleteAnalysisRequest,
  DeleteAnalysisResponse,
  ListAnalysisRunsRequest,
  PaginationResult,
  ReplayAnalysisRequest,
  ReplayAnalysisResponse,
  RunAnalysisRequest,
  RunAnalysisResponse,
  StatusSummaryRequest,
} from "../../../server/analysis-api/contracts";
import { INTERNAL_ANALYSIS_API_PREFIX } from "../../../server/analysis-api/contracts";
import {
  normalizeAnalysisClientError,
} from "./analysis-api-client-error";
import { parseAnalysisApiResponse } from "./analysis-api-envelope";

export type AnalysisApiRequestOptions = {
  signal?: AbortSignal;
};

export type AnalysisApiClientOptions = {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export class AnalysisApiClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof globalThis.fetch;

  constructor(options: AnalysisApiClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "");
    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new Error("AnalysisApiClient requires a fetch implementation.");
    }
    this.fetchImplementation = fetchImplementation.bind(globalThis);
  }

  runAnalysis(
    input: RunAnalysisRequest,
    options?: AnalysisApiRequestOptions,
  ): Promise<RunAnalysisResponse> {
    return this.request("/analysis-runs", {
      method: "POST",
      body: JSON.stringify(input),
      signal: options?.signal,
    });
  }

  listAnalysisRuns(
    input: ListAnalysisRunsRequest,
    options?: AnalysisApiRequestOptions,
  ): Promise<PaginationResult<AnalysisSummary>> {
    return this.request(
      `/analysis-runs${serializeAnalysisQuery(input)}`,
      { method: "GET", signal: options?.signal },
    );
  }

  getAnalysis(
    analysisRunId: string,
    options?: AnalysisApiRequestOptions,
  ): Promise<AnalysisDetails> {
    return this.request(
      `/analysis-runs/${encodeURIComponent(analysisRunId)}`,
      { method: "GET", signal: options?.signal },
    );
  }

  getAnalysisHistory(
    analysisRunId: string,
    options?: AnalysisApiRequestOptions,
  ): Promise<AnalysisHistory> {
    return this.request(
      `/analysis-runs/${encodeURIComponent(analysisRunId)}/history`,
      { method: "GET", signal: options?.signal },
    );
  }

  replayAnalysis(
    analysisRunId: string,
    input: ReplayAnalysisRequest,
    options?: AnalysisApiRequestOptions,
  ): Promise<ReplayAnalysisResponse> {
    return this.request(
      `/analysis-runs/${encodeURIComponent(analysisRunId)}/replay`,
      {
        method: "POST",
        body: JSON.stringify(input),
        signal: options?.signal,
      },
    );
  }

  deleteAnalysis(
    analysisRunId: string,
    input: DeleteAnalysisRequest = {},
    options?: AnalysisApiRequestOptions,
  ): Promise<DeleteAnalysisResponse> {
    const query = new URLSearchParams();
    if (input.expectedRevision !== undefined) {
      query.set("expectedRevision", String(input.expectedRevision));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.request(
      `/analysis-runs/${encodeURIComponent(analysisRunId)}${suffix}`,
      { method: "DELETE", signal: options?.signal },
    );
  }

  getStatusSummary(
    input: StatusSummaryRequest,
    options?: AnalysisApiRequestOptions,
  ): Promise<AnalysisStatusSummary> {
    return this.request(
      `/analysis-runs/status-summary${serializeAnalysisQuery(input)}`,
      { method: "GET", signal: options?.signal },
    );
  }

  private async request<TData>(
    path: string,
    init: RequestInit,
  ): Promise<TData> {
    try {
      const response = await this.fetchImplementation(
        `${this.baseUrl}${INTERNAL_ANALYSIS_API_PREFIX}${path}`,
        {
          ...init,
          headers: {
            accept: "application/json",
            ...(init.body
              ? { "content-type": "application/json" }
              : {}),
          },
          cache: "no-store",
        },
      );
      return await parseAnalysisApiResponse<TData>(response);
    } catch (error) {
      throw normalizeAnalysisClientError(error);
    }
  }
}

function serializeAnalysisQuery(
  input: ListAnalysisRunsRequest | StatusSummaryRequest,
): string {
  const query = new URLSearchParams();
  query.set("channelId", input.channelId);
  setOptional(query, "creatorId", input.creatorId);
  setOptional(query, "status", input.status);
  setOptional(query, "from", input.from);
  setOptional(query, "to", input.to);
  setOptional(
    query,
    "attempt",
    input.attempt === undefined ? undefined : String(input.attempt),
  );
  setOptional(query, "analysisId", input.analysisId);
  if ("cursor" in input) {
    setOptional(query, "cursor", input.cursor);
  }
  if ("limit" in input) {
    setOptional(
      query,
      "limit",
      input.limit === undefined ? undefined : String(input.limit),
    );
  }
  return `?${query.toString()}`;
}

function setOptional(
  query: URLSearchParams,
  key: string,
  value: string | undefined,
): void {
  if (value !== undefined) {
    query.set(key, value);
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
