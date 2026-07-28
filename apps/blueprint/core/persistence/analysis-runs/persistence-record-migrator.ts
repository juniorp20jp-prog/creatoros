import { ANALYSIS_RUN_SCHEMA_VERSION } from "./analysis-run-model";
import {
  mapPersistenceRecordToAnalysisRun,
  mapAnalysisRunToPersistenceRecord,
} from "./analysis-run-persistence-mapper";
import type {
  AnalysisRunPersistenceRecord,
} from "./analysis-run-persistence-record";

export type PersistenceRecordMigrationErrorCode =
  | "unknown-source-version"
  | "unsupported-target-version"
  | "migration-unavailable"
  | "invalid-source-record";

export type PersistenceRecordMigrationError = {
  code: PersistenceRecordMigrationErrorCode;
  message: string;
  sourceVersion?: number;
  targetVersion: number;
};

export type PersistenceRecordMigrationResult =
  | {
      status: "success";
      record: AnalysisRunPersistenceRecord;
      migrated: boolean;
    }
  | {
      status: "failure";
      error: PersistenceRecordMigrationError;
    };

export interface PersistenceRecordMigrator {
  migrate(
    record: unknown,
    targetVersion: number,
  ): PersistenceRecordMigrationResult;
}

/**
 * Validates records already at the current version and rejects every implicit
 * conversion. Future N -> N+1 migrations can replace this boundary without
 * changing repositories or callers.
 */
export class CurrentAnalysisRunPersistenceRecordMigrator
  implements PersistenceRecordMigrator
{
  migrate(
    record: unknown,
    targetVersion: number,
  ): PersistenceRecordMigrationResult {
    if (targetVersion !== ANALYSIS_RUN_SCHEMA_VERSION) {
      return {
        status: "failure",
        error: {
          code: "unsupported-target-version",
          message: `Target schema ${targetVersion} is not supported.`,
          targetVersion,
        },
      };
    }

    const sourceVersion = this.sourceVersion(record);
    if (sourceVersion === undefined) {
      return {
        status: "failure",
        error: {
          code: "unknown-source-version",
          message: "Persistence record does not declare a numeric schema.",
          targetVersion,
        },
      };
    }

    if (sourceVersion !== ANALYSIS_RUN_SCHEMA_VERSION) {
      return {
        status: "failure",
        error: {
          code: "migration-unavailable",
          message: `No explicit migration exists from schema ${sourceVersion} to ${targetVersion}.`,
          sourceVersion,
          targetVersion,
        },
      };
    }

    const mapped = mapPersistenceRecordToAnalysisRun(record);
    if (mapped.status === "failure") {
      return {
        status: "failure",
        error: {
          code: "invalid-source-record",
          message: "Current-version persistence record is invalid.",
          sourceVersion,
          targetVersion,
        },
      };
    }

    const canonical = mapAnalysisRunToPersistenceRecord(mapped.value);
    if (canonical.status === "failure") {
      return {
        status: "failure",
        error: {
          code: "invalid-source-record",
          message: "Persistence record cannot be mapped canonically.",
          sourceVersion,
          targetVersion,
        },
      };
    }

    return {
      status: "success",
      record: canonical.value,
      migrated: false,
    };
  }

  private sourceVersion(record: unknown): number | undefined {
    if (record === null || typeof record !== "object") {
      return undefined;
    }
    const value = Reflect.get(record, "schemaVersion");
    return typeof value === "number" && Number.isInteger(value)
      ? value
      : undefined;
  }
}
