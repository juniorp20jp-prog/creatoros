import { SystemClock, type Clock } from "../../services";
import { canTransitionAnalysisRun } from "../analysis-runs/analysis-run-lifecycle";
import type {
  AnalysisRun,
  AnalysisRunHistoryPage,
  AnalysisRunHistoryQuery,
  AnalysisRunMutationOptions,
  AnalysisRunStatus,
  CompleteAnalysisRunInput,
  CreateAnalysisRunInput,
  DeleteManyAnalysisRunsInput,
  FailAnalysisRunInput,
} from "../analysis-runs/analysis-run-model";
import { ANALYSIS_RUN_SCHEMA_VERSION } from "../analysis-runs/analysis-run-model";
import {
  mapAnalysisRunToPersistenceRecord,
  mapPersistenceRecordToAnalysisRun,
} from "../analysis-runs/analysis-run-persistence-mapper";
import type { AnalysisRunRepository } from "../analysis-runs/analysis-run-repository";
import type {
  AnalysisRunRepositoryError,
  AnalysisRunRepositoryResult,
} from "../analysis-runs/analysis-run-repository-error";
import type { AnalysisRunPrismaClient } from "./prisma-client";
import type { AnalysisRunRow, Prisma } from "./generated/client";
import {
  mapAnalysisRunRecordToPrismaCreate,
  mapAnalysisRunRecordToPrismaUpdate,
  mapPrismaRowToAnalysisRunRecord,
} from "./prisma-analysis-run-row-mapper";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function success<TValue>(value: TValue): AnalysisRunRepositoryResult<TValue> {
  return { status: "success", value };
}

function failure<TValue>(
  error: AnalysisRunRepositoryError,
): AnalysisRunRepositoryResult<TValue> {
  return { status: "failure", error };
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

class AtomicBatchConflict extends Error {
  constructor(readonly analysisRunId?: string) {
    super("Atomic analysis run batch changed concurrently.");
    this.name = "AtomicBatchConflict";
  }
}

export class PrismaAnalysisRunRepository implements AnalysisRunRepository {
  constructor(
    private readonly client: AnalysisRunPrismaClient,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async create(
    input: CreateAnalysisRunInput,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const inputError = this.validateCreateInput(input);
    if (inputError) {
      return failure(inputError);
    }

    const analysisRunId = input.analysisRunId.trim();
    const timestamp = this.timestamp(analysisRunId);
    if (timestamp.status === "failure") {
      return timestamp;
    }

    let source: AnalysisRun["source"];
    try {
      source = structuredClone(input.source);
    } catch {
      return failure({
        code: "persistence-failure",
        message: "Analysis run source metadata is invalid.",
        analysisRunId,
      });
    }

    const run: AnalysisRun = {
      schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
      revision: 1,
      analysisRunId,
      creatorId: input.creatorId.trim(),
      channelId: input.channelId.trim(),
      status: "pending",
      source,
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
            retryOfAnalysisRunId: input.retryOfAnalysisRunId.trim(),
          }
        : {}),
    };
    const record = mapAnalysisRunToPersistenceRecord(run);
    if (record.status === "failure") {
      return this.mappingFailure(analysisRunId, record.error.code);
    }

    try {
      const row = await this.client.analysisRunRow.create({
        data: mapAnalysisRunRecordToPrismaCreate(record.value),
      });
      return this.mapRow(row);
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        return failure({
          code: "duplicate-id",
          message: `Analysis run ${analysisRunId} already exists.`,
          analysisRunId,
        });
      }
      return this.databaseFailure(analysisRunId);
    }
  }

  async getById(
    analysisRunId: string,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    try {
      const row = await this.client.analysisRunRow.findUnique({
        where: { analysisRunId },
      });
      return row ? this.mapRow(row) : this.notFound(analysisRunId);
    } catch {
      return this.databaseFailure(analysisRunId);
    }
  }

  async updateStatus(
    analysisRunId: string,
    status: AnalysisRunStatus,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    return this.mutate(analysisRunId, status, options, (current, timestamp) =>
      status === "completed" || status === "failed"
        ? this.invalidTransition(analysisRunId, current.status, status)
        : {
            ...current,
            revision: current.revision + 1,
            status,
            updatedAt: timestamp,
          },
    );
  }

  async complete(
    analysisRunId: string,
    input: CompleteAnalysisRunInput,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    return this.mutate(
      analysisRunId,
      "completed",
      options,
      (current, timestamp) => {
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

        return {
          ...current,
          revision: current.revision + 1,
          status: "completed",
          adapterMetadata: structuredClone(input.adapterMetadata),
          adapterWarnings: structuredClone(input.adapterWarnings),
          analysisResult: structuredClone(input.analysisResult),
          updatedAt: timestamp,
          completedAt: timestamp,
        };
      },
    );
  }

  async fail(
    analysisRunId: string,
    input: FailAnalysisRunInput,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    return this.mutate(
      analysisRunId,
      "failed",
      options,
      (current, timestamp) => ({
        ...current,
        revision: current.revision + 1,
        status: "failed",
        adapterWarnings: structuredClone(input.adapterWarnings ?? []),
        failure: structuredClone(input.failure),
        updatedAt: timestamp,
        completedAt: timestamp,
        ...(input.adapterMetadata
          ? {
              adapterMetadata: structuredClone(input.adapterMetadata),
            }
          : {}),
      }),
    );
  }

  async listByChannel(
    query: AnalysisRunHistoryQuery,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRunHistoryPage>> {
    const queryError = this.validateQuery(query);
    if (queryError) {
      return failure(queryError);
    }

    try {
      const cursor = query.cursor
        ? await this.client.analysisRunRow.findFirst({
            where: {
              analysisRunId: query.cursor,
              channelId: query.channelId,
              ...(query.status ? { status: query.status } : {}),
            },
          })
        : null;
      if (query.cursor && !cursor) {
        return failure({
          code: "invalid-query",
          message: "History cursor does not exist in the result set.",
        });
      }

      const afterCursor: Prisma.AnalysisRunRowWhereInput | undefined = cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              {
                createdAt: cursor.createdAt,
                analysisRunId: { gt: cursor.analysisRunId },
              },
            ],
          }
        : undefined;
      const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
      const rows = await this.client.analysisRunRow.findMany({
        where: {
          channelId: query.channelId,
          ...(query.status ? { status: query.status } : {}),
          ...(afterCursor ?? {}),
        },
        orderBy: [{ createdAt: "desc" }, { analysisRunId: "asc" }],
        take: limit + 1,
      });

      const mapped: AnalysisRun[] = [];
      for (const row of rows.slice(0, limit)) {
        const result = this.mapRow(row);
        if (result.status === "failure") {
          return result;
        }
        mapped.push(result.value);
      }

      return success({
        items: mapped,
        nextCursor:
          rows.length > limit && mapped.length > 0
            ? mapped[mapped.length - 1]!.analysisRunId
            : null,
      });
    } catch {
      return this.databaseFailure();
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

    try {
      const row = await this.client.analysisRunRow.findFirst({
        where: { channelId, status: "completed" },
        orderBy: [{ createdAt: "desc" }, { analysisRunId: "asc" }],
      });
      if (!row) {
        return success(null);
      }
      const mapped = this.mapRow(row);
      return mapped.status === "success" ? success(mapped.value) : mapped;
    } catch {
      return this.databaseFailure();
    }
  }

  async deleteById(
    analysisRunId: string,
    options?: AnalysisRunMutationOptions,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const expectedError = this.validateExpectedRevisionValue(
      analysisRunId,
      options?.expectedRevision,
    );
    if (expectedError) {
      return failure(expectedError);
    }

    try {
      const row = await this.client.analysisRunRow.findUnique({
        where: { analysisRunId },
      });
      if (!row) {
        return this.notFound(analysisRunId);
      }
      const current = this.mapRow(row);
      if (current.status === "failure") {
        return current;
      }
      const mismatch = this.expectedRevisionMismatch(
        current.value,
        options?.expectedRevision,
      );
      if (mismatch) {
        return failure(mismatch);
      }

      const deleted = await this.client.analysisRunRow.deleteMany({
        where: {
          analysisRunId,
          revision: current.value.revision,
        },
      });
      if (deleted.count !== 1) {
        return this.concurrentMutation(analysisRunId, current.value.revision);
      }
      return success(current.value);
    } catch {
      return this.databaseFailure(analysisRunId);
    }
  }

  async deleteMany(
    input: DeleteManyAnalysisRunsInput,
  ): Promise<AnalysisRunRepositoryResult<ReadonlyArray<AnalysisRun>>> {
    const inputError = this.validateDeleteManyInput(input);
    if (inputError) {
      return failure(inputError);
    }

    try {
      return await this.client.$transaction(async (transaction) => {
        const rows = await transaction.analysisRunRow.findMany({
          where: {
            analysisRunId: { in: [...input.analysisRunIds] },
          },
        });
        const rowsById = new Map(rows.map((row) => [row.analysisRunId, row]));
        const runs: AnalysisRun[] = [];

        for (const analysisRunId of input.analysisRunIds) {
          const row = rowsById.get(analysisRunId);
          if (!row) {
            return failure({
              code: "not-found",
              message: `Analysis run ${analysisRunId} was not found.`,
              analysisRunId,
            });
          }
          const mapped = this.mapRow(row);
          if (mapped.status === "failure") {
            return mapped;
          }
          const mismatch = this.expectedRevisionMismatch(
            mapped.value,
            input.expectedRevisions?.[analysisRunId],
          );
          if (mismatch) {
            return failure(mismatch);
          }
          runs.push(mapped.value);
        }

        const deleted = await transaction.analysisRunRow.deleteMany({
          where: {
            OR: runs.map((run) => ({
              analysisRunId: run.analysisRunId,
              revision: run.revision,
            })),
          },
        });
        if (deleted.count !== runs.length) {
          throw new AtomicBatchConflict(
            runs.find(
              (run) =>
                input.expectedRevisions?.[run.analysisRunId] !== undefined,
            )?.analysisRunId,
          );
        }
        return success(runs);
      });
    } catch (error) {
      if (error instanceof AtomicBatchConflict) {
        return failure({
          code: "concurrency-conflict",
          message: "Analysis runs changed during the atomic deletion.",
          ...(error.analysisRunId
            ? { analysisRunId: error.analysisRunId }
            : {}),
        });
      }
      return this.databaseFailure();
    }
  }

  private async mutate(
    analysisRunId: string,
    targetStatus: AnalysisRunStatus,
    options: AnalysisRunMutationOptions | undefined,
    build:
      | ((
          current: AnalysisRun,
          timestamp: string,
        ) => AnalysisRun | AnalysisRunRepositoryResult<AnalysisRun>)
      | undefined,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    const expectedError = this.validateExpectedRevisionValue(
      analysisRunId,
      options?.expectedRevision,
    );
    if (expectedError) {
      return failure(expectedError);
    }

    try {
      const row = await this.client.analysisRunRow.findUnique({
        where: { analysisRunId },
      });
      if (!row) {
        return this.notFound(analysisRunId);
      }
      const mapped = this.mapRow(row);
      if (mapped.status === "failure") {
        return mapped;
      }
      const current = mapped.value;
      const mismatch = this.expectedRevisionMismatch(
        current,
        options?.expectedRevision,
      );
      if (mismatch) {
        return failure(mismatch);
      }
      if (!canTransitionAnalysisRun(current.status, targetStatus)) {
        return this.invalidTransition(
          analysisRunId,
          current.status,
          targetStatus,
        );
      }

      const timestamp = this.timestamp(analysisRunId);
      if (timestamp.status === "failure") {
        return timestamp;
      }
      const candidate = build?.(current, timestamp.value);
      if (!candidate) {
        return this.databaseFailure(analysisRunId);
      }
      if ("error" in candidate) {
        return candidate;
      }
      const next = candidate as AnalysisRun;
      const record = mapAnalysisRunToPersistenceRecord(next);
      if (record.status === "failure") {
        return this.mappingFailure(analysisRunId, record.error.code);
      }

      const updated = await this.client.analysisRunRow.updateManyAndReturn({
        where: {
          analysisRunId,
          revision: current.revision,
          status: current.status,
        },
        data: mapAnalysisRunRecordToPrismaUpdate(record.value),
      });
      if (updated.length !== 1) {
        return this.concurrentMutation(analysisRunId, current.revision);
      }
      return this.mapRow(updated[0]!);
    } catch {
      return this.databaseFailure(analysisRunId);
    }
  }

  private async concurrentMutation(
    analysisRunId: string,
    expectedRevision: number,
  ): Promise<AnalysisRunRepositoryResult<AnalysisRun>> {
    try {
      const row = await this.client.analysisRunRow.findUnique({
        where: { analysisRunId },
      });
      if (!row) {
        return this.notFound(analysisRunId);
      }
      const current = this.mapRow(row);
      if (current.status === "failure") {
        return current;
      }
      return failure({
        code: "concurrency-conflict",
        message: `Analysis run ${analysisRunId} changed concurrently.`,
        analysisRunId,
        expectedRevision,
        actualRevision: current.value.revision,
      });
    } catch {
      return this.databaseFailure(analysisRunId);
    }
  }

  private mapRow(
    row: AnalysisRunRow,
  ): AnalysisRunRepositoryResult<AnalysisRun> {
    const mapped = mapPersistenceRecordToAnalysisRun(
      mapPrismaRowToAnalysisRunRecord(row),
    );
    if (mapped.status === "failure") {
      return this.mappingFailure(row.analysisRunId, mapped.error.code);
    }
    return success(mapped.value);
  }

  private mappingFailure(
    analysisRunId: string,
    code: string,
  ): AnalysisRunRepositoryResult<AnalysisRun> {
    return failure({
      code:
        code === "incompatible-schema-version"
          ? "version-incompatibility"
          : "persistence-failure",
      message:
        code === "incompatible-schema-version"
          ? "Stored analysis run schema is not supported."
          : "Stored analysis run data is invalid.",
      analysisRunId,
    });
  }

  private databaseFailure<TValue = AnalysisRun>(
    analysisRunId?: string,
  ): AnalysisRunRepositoryResult<TValue> {
    return failure({
      code: "persistence-failure",
      message: "PostgreSQL analysis persistence failed.",
      ...(analysisRunId ? { analysisRunId } : {}),
    });
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

  private timestamp(
    analysisRunId: string,
  ): AnalysisRunRepositoryResult<string> {
    let value: string;
    try {
      value = this.clock.now();
    } catch {
      return this.databaseFailure(analysisRunId);
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
    if (query.cursor !== undefined && !isNonEmptyString(query.cursor)) {
      return {
        code: "invalid-query",
        message: "cursor must be omitted or non-empty.",
      };
    }
    return undefined;
  }

  private validateExpectedRevisionValue(
    analysisRunId: string,
    expectedRevision: number | undefined,
  ): AnalysisRunRepositoryError | undefined {
    if (
      expectedRevision !== undefined &&
      (!Number.isInteger(expectedRevision) || expectedRevision < 1)
    ) {
      return {
        code: "invalid-query",
        message: "expectedRevision must be a positive integer.",
        analysisRunId,
      };
    }
    return undefined;
  }

  private expectedRevisionMismatch(
    current: AnalysisRun,
    expectedRevision: number | undefined,
  ): AnalysisRunRepositoryError | undefined {
    if (
      expectedRevision === undefined ||
      expectedRevision === current.revision
    ) {
      return undefined;
    }
    return {
      code: "concurrency-conflict",
      message: `Analysis run ${current.analysisRunId} has revision ${current.revision}, not ${expectedRevision}.`,
      analysisRunId: current.analysisRunId,
      expectedRevision,
      actualRevision: current.revision,
    };
  }

  private validateDeleteManyInput(
    input: DeleteManyAnalysisRunsInput,
  ): AnalysisRunRepositoryError | undefined {
    if (input.analysisRunIds.length === 0) {
      return {
        code: "invalid-query",
        message: "deleteMany requires at least one explicit analysis run id.",
      };
    }
    if (
      input.analysisRunIds.some(
        (analysisRunId) => !isNonEmptyString(analysisRunId),
      )
    ) {
      return {
        code: "invalid-query",
        message: "Deletion identifiers must be non-empty strings.",
      };
    }
    if (new Set(input.analysisRunIds).size !== input.analysisRunIds.length) {
      return {
        code: "invalid-query",
        message: "Deletion identifiers must be unique.",
      };
    }
    if (
      input.expectedRevisions &&
      Object.keys(input.expectedRevisions).some(
        (analysisRunId) => !input.analysisRunIds.includes(analysisRunId),
      )
    ) {
      return {
        code: "invalid-query",
        message:
          "Expected revisions may reference only explicit deletion identifiers.",
      };
    }
    if (
      input.expectedRevisions &&
      Object.values(input.expectedRevisions).some(
        (revision) => !Number.isInteger(revision) || revision < 1,
      )
    ) {
      return {
        code: "invalid-query",
        message: "Expected revisions must be positive integers.",
      };
    }
    return undefined;
  }
}
