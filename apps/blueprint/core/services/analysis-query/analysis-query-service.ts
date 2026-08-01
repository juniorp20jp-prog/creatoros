import type {
  AnalysisRun,
  AnalysisRunRepository,
  AnalysisRunRepositoryError,
  AnalysisRunStatus,
} from "../../persistence";
import type { Clock } from "../execution-context";
import {
  analysisFilterSignature,
  decodeAnalysisQueryCursor,
  encodeAnalysisQueryCursor,
} from "./cursor";
import {
  DEFAULT_ANALYSIS_QUERY_PAGE_SIZE,
  MAX_ANALYSIS_QUERY_PAGE_SIZE,
  type AnalysisCountQuery,
  type AnalysisQueryError,
  type AnalysisQueryFilters,
  type AnalysisQueryOperation,
  type AnalysisQueryResult,
  type AnalysisScopedListQuery,
  type GetAnalysisHistoryQuery,
  type ListAnalysisRunsQuery,
} from "./contracts";
import {
  mapAnalysisRunToDetails,
  mapAnalysisRunToHistoryItem,
  mapAnalysisRunToSummary,
  resolveAnalysisReadStatus,
} from "./mapper";
import type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisStatusSummary,
  AnalysisSummary,
  PaginationResult,
} from "./read-models";

const REPOSITORY_SCAN_PAGE_SIZE = 100;

type ValidatedListQuery = {
  filters: AnalysisQueryFilters;
  pageSize: number;
  cursor?: string;
};

export class AnalysisQueryService {
  constructor(
    private readonly repository: AnalysisRunRepository,
    private readonly clock: Clock,
  ) {}

  async getAnalysisById(
    analysisRunId: string,
  ): Promise<AnalysisQueryResult<AnalysisDetails>> {
    const identifierError = this.validateIdentifier(
      analysisRunId,
      "get-analysis-by-id",
    );
    if (identifierError) {
      return this.failure(identifierError);
    }

    try {
      const result = await this.repository.getById(
        analysisRunId.trim(),
      );
      if (result.status === "failure") {
        return this.repositoryFailure(
          "get-analysis-by-id",
          result.error,
          analysisRunId,
        );
      }
      return this.success(
        mapAnalysisRunToDetails(result.value),
      );
    } catch {
      return this.unexpectedFailure(
        "get-analysis-by-id",
        analysisRunId,
      );
    }
  }

  async listAnalysisRuns(
    query: ListAnalysisRunsQuery,
  ): Promise<
    AnalysisQueryResult<PaginationResult<AnalysisSummary>>
  > {
    const validated = this.validateListQuery(query);
    if (validated.status === "failure") {
      return validated;
    }
    return this.scanPage(validated.value);
  }

  async listLatestAnalysis(
    query: AnalysisCountQuery,
  ): Promise<AnalysisQueryResult<AnalysisSummary | null>> {
    const page = await this.listAnalysisRuns({
      filters: query.filters,
      pageSize: 1,
    });
    if (page.status === "failure") {
      return page;
    }
    return this.success(page.value.items[0] ?? null);
  }

  listFailedAnalysis(
    query: AnalysisScopedListQuery,
  ): Promise<
    AnalysisQueryResult<PaginationResult<AnalysisSummary>>
  > {
    return this.listWithStatus(query, "failed");
  }

  listCompletedAnalysis(
    query: AnalysisScopedListQuery,
  ): Promise<
    AnalysisQueryResult<PaginationResult<AnalysisSummary>>
  > {
    return this.listWithStatus(query, "completed");
  }

  listPartialAnalysis(
    query: AnalysisScopedListQuery,
  ): Promise<
    AnalysisQueryResult<PaginationResult<AnalysisSummary>>
  > {
    return this.listWithStatus(query, "partial");
  }

  async getAnalysisHistory(
    query: GetAnalysisHistoryQuery,
  ): Promise<AnalysisQueryResult<AnalysisHistory>> {
    const identifierError = this.validateIdentifier(
      query.analysisRunId,
      "get-analysis-history",
    );
    if (identifierError) {
      return this.failure(identifierError);
    }

    try {
      const selected = await this.repository.getById(
        query.analysisRunId.trim(),
      );
      if (selected.status === "failure") {
        return this.repositoryFailure(
          "get-analysis-history",
          selected.error,
          query.analysisRunId,
        );
      }

      const channelRuns = await this.collectRuns(
        {
          channelId: selected.value.channelId,
        },
        "get-analysis-history",
      );
      if (channelRuns.status === "failure") {
        return channelRuns;
      }

      const byId = new Map(
        channelRuns.value.map((run) => [
          run.analysisRunId,
          run,
        ]),
      );
      let root = selected.value;
      const parentIds = new Set<string>();
      while (
        root.retryOfAnalysisRunId &&
        !parentIds.has(root.retryOfAnalysisRunId)
      ) {
        parentIds.add(root.retryOfAnalysisRunId);
        const parent = byId.get(
          root.retryOfAnalysisRunId,
        );
        if (!parent) {
          break;
        }
        root = parent;
      }

      const relatedIds = new Set([root.analysisRunId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const run of channelRuns.value) {
          if (
            run.retryOfAnalysisRunId &&
            relatedIds.has(run.retryOfAnalysisRunId) &&
            !relatedIds.has(run.analysisRunId)
          ) {
            relatedIds.add(run.analysisRunId);
            changed = true;
          }
        }
      }

      const items = channelRuns.value
        .filter((run) =>
          relatedIds.has(run.analysisRunId),
        )
        .sort(compareHistoryAscending)
        .map(mapAnalysisRunToHistoryItem);
      return this.withTimestamp(
        "get-analysis-history",
        (queriedAt) => ({
          rootAnalysisRunId: root.analysisRunId,
          requestedAnalysisRunId:
            selected.value.analysisRunId,
          channelId: selected.value.channelId,
          items,
          queriedAt,
        }),
      );
    } catch {
      return this.unexpectedFailure(
        "get-analysis-history",
        query.analysisRunId,
      );
    }
  }

  async analysisExists(
    analysisRunId: string,
  ): Promise<AnalysisQueryResult<boolean>> {
    const identifierError = this.validateIdentifier(
      analysisRunId,
      "analysis-exists",
    );
    if (identifierError) {
      return this.failure(identifierError);
    }

    try {
      const result = await this.repository.getById(
        analysisRunId.trim(),
      );
      if (
        result.status === "failure" &&
        result.error.code === "not-found"
      ) {
        return this.success(false);
      }
      if (result.status === "failure") {
        return this.repositoryFailure(
          "analysis-exists",
          result.error,
          analysisRunId,
        );
      }
      return this.success(true);
    } catch {
      return this.unexpectedFailure(
        "analysis-exists",
        analysisRunId,
      );
    }
  }

  async countAnalysisRuns(
    query: AnalysisCountQuery,
  ): Promise<AnalysisQueryResult<number>> {
    const filters = this.validateFilters(
      query.filters,
      "count-analysis-runs",
    );
    if (filters.status === "failure") {
      return filters;
    }
    const runs = await this.collectRuns(
      filters.value,
      "count-analysis-runs",
    );
    return runs.status === "failure"
      ? runs
      : this.success(runs.value.length);
  }

  async summarizeAnalysisRuns(
    query: AnalysisCountQuery,
  ): Promise<AnalysisQueryResult<AnalysisStatusSummary>> {
    const filters = this.validateFilters(
      query.filters,
      "summarize-analysis-runs",
    );
    if (filters.status === "failure") {
      return filters;
    }
    const runs = await this.collectRuns(
      filters.value,
      "summarize-analysis-runs",
    );
    if (runs.status === "failure") {
      return runs;
    }

    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      partial: 0,
      failed: 0,
    };
    for (const run of runs.value) {
      counts[resolveAnalysisReadStatus(run)] += 1;
    }
    return this.withTimestamp(
      "summarize-analysis-runs",
      (queriedAt) => ({
        channelId: filters.value.channelId,
        total: runs.value.length,
        counts,
        queriedAt,
      }),
    );
  }

  private listWithStatus(
    query: AnalysisScopedListQuery,
    status: "failed" | "completed" | "partial",
  ): Promise<
    AnalysisQueryResult<PaginationResult<AnalysisSummary>>
  > {
    return this.listAnalysisRuns({
      ...query,
      filters: {
        ...query.filters,
        status,
      },
    });
  }

  private async scanPage(
    query: ValidatedListQuery,
  ): Promise<
    AnalysisQueryResult<PaginationResult<AnalysisSummary>>
  > {
    const signature = analysisFilterSignature(
      query.filters,
    );
    let repositoryCursor: string | undefined;
    if (query.cursor) {
      const cursor = decodeAnalysisQueryCursor(query.cursor);
      if (
        !cursor ||
        cursor.filterSignature !== signature
      ) {
        return this.failure({
          code: "invalid-cursor",
          operation: "list-analysis-runs",
          message:
            "Analysis query cursor is invalid or belongs to different filters.",
          causeCode: "INVALID_QUERY_CURSOR",
        });
      }
      repositoryCursor = cursor.repositoryCursor;
    }

    const matches: AnalysisRun[] = [];
    let lastIncludedRunId: string | undefined;
    const seenCursors = new Set<string>();
    try {
      while (matches.length <= query.pageSize) {
        const page = await this.repository.listByChannel({
          channelId: query.filters.channelId,
          limit: REPOSITORY_SCAN_PAGE_SIZE,
          ...(repositoryCursor
            ? { cursor: repositoryCursor }
            : {}),
          ...(this.repositoryStatus(query.filters.status)
            ? {
                status: this.repositoryStatus(
                  query.filters.status,
                ),
              }
            : {}),
        });
        if (page.status === "failure") {
          return this.repositoryFailure(
            "list-analysis-runs",
            page.error,
          );
        }

        for (const run of page.value.items) {
          if (this.matchesFilters(run, query.filters)) {
            matches.push(run);
            if (matches.length === query.pageSize) {
              lastIncludedRunId = run.analysisRunId;
            }
            if (matches.length > query.pageSize) {
              break;
            }
          }
        }
        if (
          matches.length > query.pageSize ||
          !page.value.nextCursor
        ) {
          break;
        }
        if (seenCursors.has(page.value.nextCursor)) {
          return this.failure({
            code: "query-failure",
            operation: "list-analysis-runs",
            message:
              "Repository pagination returned a repeated cursor.",
            causeCode: "REPEATED_REPOSITORY_CURSOR",
          });
        }
        seenCursors.add(page.value.nextCursor);
        repositoryCursor = page.value.nextCursor;
      }
    } catch {
      return this.unexpectedFailure(
        "list-analysis-runs",
      );
    }

    const hasNextPage =
      matches.length > query.pageSize &&
      lastIncludedRunId !== undefined;
    const items = matches
      .slice(0, query.pageSize)
      .map(mapAnalysisRunToSummary);
    const nextCursor =
      hasNextPage && lastIncludedRunId
        ? encodeAnalysisQueryCursor({
            version: 1,
            repositoryCursor: lastIncludedRunId,
            filterSignature: signature,
          })
        : null;
    return this.withTimestamp(
      "list-analysis-runs",
      (queriedAt) => ({
        items,
        pageSize: query.pageSize,
        cursor: {
          nextCursor,
          hasNextPage,
        },
        queriedAt,
      }),
    );
  }

  private async collectRuns(
    filters: AnalysisQueryFilters,
    operation: AnalysisQueryOperation,
  ): Promise<AnalysisQueryResult<ReadonlyArray<AnalysisRun>>> {
    const runs: AnalysisRun[] = [];
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    try {
      do {
        const page = await this.repository.listByChannel({
          channelId: filters.channelId,
          limit: REPOSITORY_SCAN_PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
          ...(this.repositoryStatus(filters.status)
            ? {
                status: this.repositoryStatus(
                  filters.status,
                ),
              }
            : {}),
        });
        if (page.status === "failure") {
          return this.repositoryFailure(
            operation,
            page.error,
          );
        }
        runs.push(
          ...page.value.items.filter((run) =>
            this.matchesFilters(run, filters),
          ),
        );
        cursor = page.value.nextCursor ?? undefined;
        if (cursor) {
          if (seenCursors.has(cursor)) {
            return this.failure({
              code: "query-failure",
              operation,
              message:
                "Repository pagination returned a repeated cursor.",
              causeCode: "REPEATED_REPOSITORY_CURSOR",
            });
          }
          seenCursors.add(cursor);
        }
      } while (cursor);
      return this.success(runs);
    } catch {
      return this.unexpectedFailure(operation);
    }
  }

  private matchesFilters(
    run: AnalysisRun,
    filters: AnalysisQueryFilters,
  ): boolean {
    return (
      run.channelId === filters.channelId &&
      (filters.status === undefined ||
        resolveAnalysisReadStatus(run) === filters.status) &&
      (filters.creatorId === undefined ||
        run.creatorId === filters.creatorId) &&
      (filters.createdFrom === undefined ||
        run.createdAt >= filters.createdFrom) &&
      (filters.createdTo === undefined ||
        run.createdAt <= filters.createdTo) &&
      (filters.attempt === undefined ||
        run.attempt === filters.attempt) &&
      (filters.analysisId === undefined ||
        run.analysisResult?.analysisId ===
          filters.analysisId)
    );
  }

  private repositoryStatus(
    status: AnalysisQueryFilters["status"],
  ): AnalysisRunStatus | undefined {
    if (status === "partial") {
      return "completed";
    }
    return status;
  }

  private validateListQuery(
    query: ListAnalysisRunsQuery,
  ): AnalysisQueryResult<ValidatedListQuery> {
    const filters = this.validateFilters(
      query.filters,
      "list-analysis-runs",
    );
    if (filters.status === "failure") {
      return filters;
    }
    const pageSize =
      query.pageSize ?? DEFAULT_ANALYSIS_QUERY_PAGE_SIZE;
    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_ANALYSIS_QUERY_PAGE_SIZE
    ) {
      return this.failure({
        code: "invalid-query",
        operation: "list-analysis-runs",
        message: `pageSize must be an integer between 1 and ${MAX_ANALYSIS_QUERY_PAGE_SIZE}.`,
        causeCode: "INVALID_PAGE_SIZE",
      });
    }
    if (
      query.cursor !== undefined &&
      query.cursor.trim().length === 0
    ) {
      return this.failure({
        code: "invalid-cursor",
        operation: "list-analysis-runs",
        message: "cursor must be omitted or non-empty.",
        causeCode: "INVALID_QUERY_CURSOR",
      });
    }
    return this.success({
      filters: filters.value,
      pageSize,
      ...(query.cursor
        ? { cursor: query.cursor }
        : {}),
    });
  }

  private validateFilters(
    filters: AnalysisQueryFilters,
    operation: AnalysisQueryOperation,
  ): AnalysisQueryResult<AnalysisQueryFilters> {
    if (filters.channelId.trim().length === 0) {
      return this.failure({
        code: "invalid-query",
        operation,
        message:
          "channelId is required by the current repository query boundary.",
        causeCode: "INVALID_CHANNEL_ID",
      });
    }
    for (const [name, value] of [
      ["creatorId", filters.creatorId],
      ["analysisId", filters.analysisId],
    ] as const) {
      if (
        value !== undefined &&
        value.trim().length === 0
      ) {
        return this.failure({
          code: "invalid-query",
          operation,
          message: `${name} must be omitted or non-empty.`,
          causeCode: `INVALID_${name.toUpperCase()}`,
        });
      }
    }
    if (
      filters.attempt !== undefined &&
      (!Number.isInteger(filters.attempt) ||
        filters.attempt < 1)
    ) {
      return this.failure({
        code: "invalid-query",
        operation,
        message: "attempt must be a positive integer.",
        causeCode: "INVALID_ATTEMPT",
      });
    }
    for (const [name, value] of [
      ["createdFrom", filters.createdFrom],
      ["createdTo", filters.createdTo],
    ] as const) {
      if (
        value !== undefined &&
        !isCanonicalTimestamp(value)
      ) {
        return this.failure({
          code: "invalid-query",
          operation,
          message: `${name} must be a canonical ISO 8601 UTC timestamp.`,
          causeCode: `INVALID_${name.toUpperCase()}`,
        });
      }
    }
    if (
      filters.createdFrom &&
      filters.createdTo &&
      filters.createdFrom > filters.createdTo
    ) {
      return this.failure({
        code: "invalid-query",
        operation,
        message:
          "createdFrom must be before or equal to createdTo.",
        causeCode: "INVALID_DATE_RANGE",
      });
    }
    return this.success({
      channelId: filters.channelId.trim(),
      ...(filters.status
        ? { status: filters.status }
        : {}),
      ...(filters.creatorId
        ? { creatorId: filters.creatorId.trim() }
        : {}),
      ...(filters.createdFrom
        ? { createdFrom: filters.createdFrom }
        : {}),
      ...(filters.createdTo
        ? { createdTo: filters.createdTo }
        : {}),
      ...(filters.attempt !== undefined
        ? { attempt: filters.attempt }
        : {}),
      ...(filters.analysisId
        ? { analysisId: filters.analysisId.trim() }
        : {}),
    });
  }

  private validateIdentifier(
    value: string,
    operation: AnalysisQueryOperation,
  ): AnalysisQueryError | undefined {
    return value.trim().length === 0
      ? {
          code: "invalid-query",
          operation,
          message: "analysisRunId must be non-empty.",
          causeCode: "INVALID_ANALYSIS_RUN_ID",
        }
      : undefined;
  }

  private repositoryFailure<TValue>(
    operation: AnalysisQueryOperation,
    error: AnalysisRunRepositoryError,
    analysisRunId?: string,
  ): AnalysisQueryResult<TValue> {
    return this.failure({
      code:
        error.code === "not-found"
          ? "not-found"
          : error.code === "invalid-query"
            ? "invalid-query"
            : "repository-failure",
      operation,
      message: error.message,
      causeCode: error.code,
      analysisRunId:
        error.analysisRunId ?? analysisRunId,
    });
  }

  private unexpectedFailure<TValue>(
    operation: AnalysisQueryOperation,
    analysisRunId?: string,
  ): AnalysisQueryResult<TValue> {
    return this.failure({
      code: "query-failure",
      operation,
      message:
        "An injected analysis query dependency failed unexpectedly.",
      causeCode: "UNEXPECTED_QUERY_DEPENDENCY_FAILURE",
      analysisRunId,
    });
  }

  private withTimestamp<TValue>(
    operation: AnalysisQueryOperation,
    createValue: (queriedAt: string) => TValue,
  ): AnalysisQueryResult<TValue> {
    try {
      return this.success(createValue(this.clock.now()));
    } catch {
      return this.failure({
        code: "query-failure",
        operation,
        message: "Analysis query clock failed.",
        causeCode: "QUERY_CLOCK_FAILURE",
      });
    }
  }

  private success<TValue>(
    value: TValue,
  ): AnalysisQueryResult<TValue> {
    return { status: "success", value };
  }

  private failure<TValue>(
    error: AnalysisQueryError,
  ): AnalysisQueryResult<TValue> {
    return { status: "failure", error };
  }
}

function isCanonicalTimestamp(value: string): boolean {
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  );
}

function compareHistoryAscending(
  left: AnalysisRun,
  right: AnalysisRun,
): number {
  const timestampOrder =
    left.createdAt.localeCompare(right.createdAt);
  return timestampOrder !== 0
    ? timestampOrder
    : left.analysisRunId.localeCompare(right.analysisRunId);
}
