import { SystemClock, type Clock } from "../../services";
import { canTransitionAnalysisRun } from "./analysis-run-lifecycle";
import type {
  AnalysisRun,
  AnalysisRunHistoryPage,
  AnalysisRunHistoryQuery,
  AnalysisRunStatus,
  CompleteAnalysisRunInput,
  CreateAnalysisRunInput,
  FailAnalysisRunInput,
} from "./analysis-run-model";
import { ANALYSIS_RUN_SCHEMA_VERSION } from "./analysis-run-model";
import type { AnalysisRunRepository } from "./analysis-run-repository";
import type {
  AnalysisRunRepositoryError,
  AnalysisRunRepositoryResult,
} from "./analysis-run-repository-error";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function success<TValue>(
  value: TValue,
): AnalysisRunRepositoryResult<TValue> {
  return {
    status: "success",
    value,
  };
}

function failure<TValue>(
  error: AnalysisRunRepositoryError,
): AnalysisRunRepositoryResult<TValue> {
  return {
    status: "failure",
    error,
  };
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function compareHistory(left: AnalysisRun, right: AnalysisRun): number {
  return (
    right.createdAt.localeCompare(left.createdAt) ||
    left.analysisRunId.localeCompare(right.analysisRunId)
  );
}

function clone<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

export class InMemoryAnalysisRunRepository
  implements AnalysisRunRepository
{
  private readonly records = new Map<string, AnalysisRun>();

  constructor(
    private readonly clock: Clock = new SystemClock(),
    initialRecords: ReadonlyArray<AnalysisRun> = [],
  ) {
    for (const record of initialRecords) {
      this.records.set(record.analysisRunId, clone(record));
    }
  }

  async create(
    input: CreateAnalysisRunInput,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const inputError = this.validateCreateInput(input);
    if (inputError) {
      return failure(inputError);
    }

    if (this.records.has(input.analysisRunId)) {
      return failure({
        code: "duplicate-id",
        message: `Analysis run ${input.analysisRunId} already exists.`,
        analysisRunId: input.analysisRunId,
      });
    }

    const timestamp = this.timestamp(input.analysisRunId);
    if (timestamp.status === "failure") {
      return timestamp;
    }

    try {
      const run: AnalysisRun = {
        schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
        analysisRunId: input.analysisRunId.trim(),
        creatorId: input.creatorId.trim(),
        channelId: input.channelId.trim(),
        status: "pending",
        source: clone(input.source),
        adapterWarnings: [],
        pipelineVersion: input.pipelineVersion.trim(),
        createdAt: timestamp.value,
        updatedAt: timestamp.value,
        attempt: input.attempt ?? 1,
        ...(input.correlationId
          ? { correlationId: input.correlationId.trim() }
          : {}),
        ...(input.retryOfAnalysisRunId
          ? {
              retryOfAnalysisRunId:
                input.retryOfAnalysisRunId.trim(),
            }
          : {}),
      };
      const stored = clone(run);
      this.records.set(stored.analysisRunId, stored);
      return success(clone(stored));
    } catch {
      return failure({
        code: "persistence-failure",
        message: "Analysis run could not be cloned for storage.",
        analysisRunId: input.analysisRunId,
      });
    }
  }

  async getById(
    analysisRunId: string,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const record = this.records.get(analysisRunId);
    if (!record) {
      return failure({
        code: "not-found",
        message: `Analysis run ${analysisRunId} was not found.`,
        analysisRunId,
      });
    }

    return this.read(record);
  }

  async updateStatus(
    analysisRunId: string,
    status: AnalysisRunStatus,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const current = this.records.get(analysisRunId);
    if (!current) {
      return this.notFound(analysisRunId);
    }

    if (
      status === "completed" ||
      status === "failed" ||
      !canTransitionAnalysisRun(current.status, status)
    ) {
      return this.invalidTransition(
        analysisRunId,
        current.status,
        status,
      );
    }

    const timestamp = this.timestamp(analysisRunId);
    if (timestamp.status === "failure") {
      return timestamp;
    }

    return this.store({
      ...current,
      status,
      updatedAt: timestamp.value,
    });
  }

  async complete(
    analysisRunId: string,
    input: CompleteAnalysisRunInput,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const current = this.records.get(analysisRunId);
    if (!current) {
      return this.notFound(analysisRunId);
    }

    if (!canTransitionAnalysisRun(current.status, "completed")) {
      return this.invalidTransition(
        analysisRunId,
        current.status,
        "completed",
      );
    }

    if (
      input.analysisResult.creator.id !== current.creatorId ||
      input.analysisResult.channel.id !== current.channelId
    ) {
      return failure({
        code: "persistence-failure",
        message:
          "Analysis result identities do not match the persisted run.",
        analysisRunId,
      });
    }

    const timestamp = this.timestamp(analysisRunId);
    if (timestamp.status === "failure") {
      return timestamp;
    }

    return this.store({
      ...current,
      status: "completed",
      adapterMetadata: clone(input.adapterMetadata),
      adapterWarnings: clone(input.adapterWarnings),
      analysisResult: clone(input.analysisResult),
      updatedAt: timestamp.value,
      completedAt: timestamp.value,
    });
  }

  async fail(
    analysisRunId: string,
    input: FailAnalysisRunInput,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const current = this.records.get(analysisRunId);
    if (!current) {
      return this.notFound(analysisRunId);
    }

    if (!canTransitionAnalysisRun(current.status, "failed")) {
      return this.invalidTransition(
        analysisRunId,
        current.status,
        "failed",
      );
    }

    const timestamp = this.timestamp(analysisRunId);
    if (timestamp.status === "failure") {
      return timestamp;
    }

    return this.store({
      ...current,
      status: "failed",
      adapterWarnings: clone(input.adapterWarnings ?? []),
      failure: clone(input.failure),
      updatedAt: timestamp.value,
      completedAt: timestamp.value,
      ...(input.adapterMetadata
        ? { adapterMetadata: clone(input.adapterMetadata) }
        : {}),
    });
  }

  async listByChannel(
    query: AnalysisRunHistoryQuery,
  ): Promise<
    AnalysisRunRepositoryResult<AnalysisRunHistoryPage>
  > {
    const queryError = this.validateQuery(query);
    if (queryError) {
      return failure(queryError);
    }

    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const records = [...this.records.values()]
      .filter(
        (record) =>
          record.channelId === query.channelId &&
          (query.status === undefined ||
            record.status === query.status),
      )
      .sort(compareHistory);
    const cursorIndex =
      query.cursor === undefined
        ? -1
        : records.findIndex(
            (record) => record.analysisRunId === query.cursor,
          );

    if (query.cursor !== undefined && cursorIndex < 0) {
      return failure({
        code: "invalid-query",
        message: "History cursor does not exist in the result set.",
      });
    }

    const start = cursorIndex + 1;
    const selected = records.slice(start, start + limit);
    const hasMore = start + selected.length < records.length;

    try {
      return success({
        items: selected.map(clone),
        nextCursor:
          hasMore && selected.length > 0
            ? selected[selected.length - 1]!.analysisRunId
            : null,
      });
    } catch {
      return failure({
        code: "persistence-failure",
        message: "Analysis run history could not be cloned.",
      });
    }
  }

  async latestCompletedByChannel(
    channelId: string,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun | null>> {
    if (!isNonEmptyString(channelId)) {
      return failure({
        code: "invalid-query",
        message: "channelId must be a non-empty string.",
      });
    }

    const record = [...this.records.values()]
      .filter(
        (candidate) =>
          candidate.channelId === channelId &&
          candidate.status === "completed",
      )
      .sort(compareHistory)[0];

    return record ? this.read(record) : success(null);
  }

  private validateCreateInput(
    input: CreateAnalysisRunInput,
  ): AnalysisRunRepositoryError | undefined {
    if (input.schemaVersion !== ANALYSIS_RUN_SCHEMA_VERSION) {
      return {
        code: "version-incompatibility",
        message: `Supported AnalysisRun schema is ${ANALYSIS_RUN_SCHEMA_VERSION}.`,
        analysisRunId: input.analysisRunId,
      };
    }

    const requiredValues = [
      input.analysisRunId,
      input.creatorId,
      input.channelId,
      input.source.sourceType,
      input.source.sourceSchemaVersion,
      input.pipelineVersion,
    ];
    if (requiredValues.some((value) => !isNonEmptyString(value))) {
      return {
        code: "persistence-failure",
        message: "Analysis run required identifiers must be non-empty.",
        analysisRunId: input.analysisRunId,
      };
    }

    if (
      input.correlationId !== undefined &&
      !isNonEmptyString(input.correlationId)
    ) {
      return {
        code: "persistence-failure",
        message: "correlationId must be omitted or non-empty.",
        analysisRunId: input.analysisRunId,
      };
    }

    const attempt = input.attempt ?? 1;
    if (!Number.isInteger(attempt) || attempt < 1) {
      return {
        code: "persistence-failure",
        message: "attempt must be a positive integer.",
        analysisRunId: input.analysisRunId,
      };
    }

    return undefined;
  }

  private validateQuery(
    query: AnalysisRunHistoryQuery,
  ): AnalysisRunRepositoryError | undefined {
    if (!isNonEmptyString(query.channelId)) {
      return {
        code: "invalid-query",
        message: "channelId must be a non-empty string.",
      };
    }

    if (
      query.limit !== undefined &&
      (!Number.isInteger(query.limit) ||
        query.limit < 1 ||
        query.limit > MAX_PAGE_LIMIT)
    ) {
      return {
        code: "invalid-query",
        message: `limit must be an integer from 1 to ${MAX_PAGE_LIMIT}.`,
      };
    }

    if (
      query.cursor !== undefined &&
      !isNonEmptyString(query.cursor)
    ) {
      return {
        code: "invalid-query",
        message: "cursor must be omitted or non-empty.",
      };
    }

    return undefined;
  }

  private timestamp(
    analysisRunId: string,
  ): AnalysisRunRepositoryResult<string> {
    let value: string;
    try {
      value = this.clock.now();
    } catch {
      return failure({
        code: "persistence-failure",
        message: "Clock could not provide a timestamp.",
        analysisRunId,
      });
    }

    const timestamp = Date.parse(value);

    if (
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString() !== value
    ) {
      return failure({
        code: "persistence-failure",
        message: "Clock returned an invalid timestamp.",
        analysisRunId,
      });
    }

    return success(value);
  }

  private read(
    record: AnalysisRun,
  ): AnalysisRunRepositoryResult<AnalysisRun> {
    if (record.schemaVersion !== ANALYSIS_RUN_SCHEMA_VERSION) {
      return failure({
        code: "version-incompatibility",
        message: `Analysis run schema ${record.schemaVersion} is not supported.`,
        analysisRunId: record.analysisRunId,
      });
    }

    try {
      return success(clone(record));
    } catch {
      return failure({
        code: "persistence-failure",
        message: "Analysis run could not be cloned from storage.",
        analysisRunId: record.analysisRunId,
      });
    }
  }

  private store(
    run: AnalysisRun,
  ): AnalysisRunRepositoryResult<AnalysisRun> {
    try {
      const stored = clone(run);
      this.records.set(run.analysisRunId, stored);
      return success(clone(stored));
    } catch {
      return failure({
        code: "persistence-failure",
        message: "Analysis run could not be cloned for storage.",
        analysisRunId: run.analysisRunId,
      });
    }
  }

  private notFound(
    analysisRunId: string,
  ): AnalysisRunRepositoryResult<AnalysisRun> {
    return failure({
      code: "not-found",
      message: `Analysis run ${analysisRunId} was not found.`,
      analysisRunId,
    });
  }

  private invalidTransition(
    analysisRunId: string,
    current: AnalysisRunStatus,
    target: AnalysisRunStatus,
  ): AnalysisRunRepositoryResult<AnalysisRun> {
    return failure({
      code: "invalid-transition",
      message: `Analysis run cannot transition from ${current} to ${target}.`,
      analysisRunId,
    });
  }
}
