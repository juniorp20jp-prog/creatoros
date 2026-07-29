import type {
  AnalysisRunPersistenceRecord,
  PersistenceJsonObject,
} from "../analysis-runs/analysis-run-persistence-record";
import { Prisma, type AnalysisRunRow } from "./generated/client";

function cloneInputJson(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

/**
 * Converts an infrastructure row into the provider-neutral record consumed by
 * the authoritative domain mapper. The domain mapper still validates every
 * value before a row becomes an AnalysisRun.
 */
export function mapPrismaRowToAnalysisRunRecord(
  row: AnalysisRunRow,
): AnalysisRunPersistenceRecord {
  return {
    schemaVersion: row.schemaVersion,
    revision: row.revision,
    analysisRunId: row.analysisRunId,
    creatorId: row.creatorId,
    channelId: row.channelId,
    status: row.status as AnalysisRunPersistenceRecord["status"],
    source: structuredClone(
      row.source,
    ) as AnalysisRunPersistenceRecord["source"],
    ...(row.adapterMetadata !== null
      ? {
          adapterMetadata: structuredClone(
            row.adapterMetadata,
          ) as AnalysisRunPersistenceRecord["adapterMetadata"],
        }
      : {}),
    adapterWarnings: structuredClone(
      row.adapterWarnings,
    ) as unknown as AnalysisRunPersistenceRecord["adapterWarnings"],
    pipelineVersion: row.pipelineVersion,
    ...(row.analysisResult !== null
      ? {
          analysisResult: structuredClone(
            row.analysisResult,
          ) as PersistenceJsonObject,
        }
      : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.completedAt !== null
      ? { completedAt: row.completedAt.toISOString() }
      : {}),
    ...(row.failure !== null
      ? {
          failure: structuredClone(
            row.failure,
          ) as AnalysisRunPersistenceRecord["failure"],
        }
      : {}),
    ...(row.correlationId !== null ? { correlationId: row.correlationId } : {}),
    attempt: row.attempt,
    ...(row.retryOfAnalysisRunId !== null
      ? { retryOfAnalysisRunId: row.retryOfAnalysisRunId }
      : {}),
  };
}

export function mapAnalysisRunRecordToPrismaCreate(
  record: AnalysisRunPersistenceRecord,
): Prisma.AnalysisRunRowCreateInput {
  return {
    analysisRunId: record.analysisRunId,
    creatorId: record.creatorId,
    channelId: record.channelId,
    status: record.status,
    schemaVersion: record.schemaVersion,
    revision: record.revision,
    source: cloneInputJson(record.source),
    ...(record.adapterMetadata !== undefined
      ? { adapterMetadata: cloneInputJson(record.adapterMetadata) }
      : {}),
    adapterWarnings: cloneInputJson(record.adapterWarnings),
    pipelineVersion: record.pipelineVersion,
    ...(record.analysisResult !== undefined
      ? { analysisResult: cloneInputJson(record.analysisResult) }
      : {}),
    ...(record.failure !== undefined
      ? { failure: cloneInputJson(record.failure) }
      : {}),
    ...(record.correlationId !== undefined
      ? { correlationId: record.correlationId }
      : {}),
    attempt: record.attempt,
    ...(record.retryOfAnalysisRunId !== undefined
      ? { retryOfAnalysisRunId: record.retryOfAnalysisRunId }
      : {}),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    ...(record.completedAt !== undefined
      ? { completedAt: new Date(record.completedAt) }
      : {}),
  };
}

export function mapAnalysisRunRecordToPrismaUpdate(
  record: AnalysisRunPersistenceRecord,
): Prisma.AnalysisRunRowUpdateManyMutationInput {
  return {
    creatorId: record.creatorId,
    channelId: record.channelId,
    status: record.status,
    schemaVersion: record.schemaVersion,
    revision: record.revision,
    source: cloneInputJson(record.source),
    adapterMetadata:
      record.adapterMetadata === undefined
        ? Prisma.DbNull
        : cloneInputJson(record.adapterMetadata),
    adapterWarnings: cloneInputJson(record.adapterWarnings),
    pipelineVersion: record.pipelineVersion,
    analysisResult:
      record.analysisResult === undefined
        ? Prisma.DbNull
        : cloneInputJson(record.analysisResult),
    failure:
      record.failure === undefined
        ? Prisma.DbNull
        : cloneInputJson(record.failure),
    correlationId: record.correlationId ?? null,
    attempt: record.attempt,
    retryOfAnalysisRunId: record.retryOfAnalysisRunId ?? null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    completedAt:
      record.completedAt === undefined ? null : new Date(record.completedAt),
  };
}
