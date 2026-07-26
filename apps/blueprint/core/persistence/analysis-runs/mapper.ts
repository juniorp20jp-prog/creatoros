import { CreatorAnalysisRunPersistenceError } from "./errors";
import type {
  CreatorAnalysisRun,
  CreatorAnalysisRunDeserializationResult,
  CreatorAnalysisRunRecord,
} from "./types";
import { CREATOR_ANALYSIS_RUN_SCHEMA_VERSION } from "./types";
import { parseCreatorAnalysisRunRecord } from "./validation";

function normalizeUtcTimestamp(value: string, path: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new CreatorAnalysisRunPersistenceError("serialization-failed", [
      { path, code: "invalid-timestamp", message: "Timestamp is invalid." },
    ]);
  }
  return new Date(timestamp).toISOString();
}

export function serializeCreatorAnalysisRun(
  run: CreatorAnalysisRun,
): CreatorAnalysisRunRecord {
  let candidate: unknown;
  try {
    candidate = structuredClone({
      ...run,
      schemaVersion: CREATOR_ANALYSIS_RUN_SCHEMA_VERSION,
      createdAt: normalizeUtcTimestamp(run.createdAt, "run.createdAt"),
      updatedAt: normalizeUtcTimestamp(run.updatedAt, "run.updatedAt"),
    });
  } catch (error) {
    if (error instanceof CreatorAnalysisRunPersistenceError) {
      throw error;
    }
    throw new CreatorAnalysisRunPersistenceError(
      "serialization-failed",
      [
        {
          path: "run",
          code: "clone-failed",
          message: "Analysis run contains a value that cannot be cloned.",
        },
      ],
    );
  }

  const parsed = parseCreatorAnalysisRunRecord(candidate);
  if (parsed.status === "invalid") {
    throw new CreatorAnalysisRunPersistenceError(
      "serialization-failed",
      parsed.error.issues,
    );
  }
  return parsed.record;
}

export function deserializeCreatorAnalysisRun(
  value: unknown,
): CreatorAnalysisRunDeserializationResult {
  const parsed = parseCreatorAnalysisRunRecord(value);
  if (parsed.status === "invalid") {
    return { status: "failure", error: parsed.error };
  }

  const record = parsed.record;
  return {
    status: "success",
    run: structuredClone({
      id: record.id,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      locale: record.locale,
      source: record.source,
      snapshots: record.snapshots,
      metadata: record.metadata,
    }),
  };
}
