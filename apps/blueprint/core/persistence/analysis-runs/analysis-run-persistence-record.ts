import type { AnalysisRunStatus } from "./analysis-run-model";

export type PersistenceJsonPrimitive =
  | null
  | boolean
  | number
  | string;

export type PersistenceJsonValue =
  | PersistenceJsonPrimitive
  | PersistenceJsonObject
  | ReadonlyArray<PersistenceJsonValue>;

export type PersistenceJsonObject = {
  readonly [key: string]: PersistenceJsonValue;
};

export type AnalysisRunPersistenceSource = {
  sourceType: string;
  sourceSchemaVersion: string;
  sourceReference?: string;
};

export type AnalysisRunPersistenceAdapterMetadata = {
  adapterId: string;
  adapterVersion: string;
  sourceType: string;
  supportedSchemaVersion: string;
  processedAt: string;
};

export type AnalysisRunPersistenceAdapterWarning = {
  severity: "warning";
  code: "MISSING_OPTIONAL_FIELD" | "UNKNOWN_FIELD_IGNORED";
  path: string;
  message: string;
};

export type AnalysisRunPersistenceFailure = {
  stage: "adapter" | "pipeline" | "persistence";
  code: string;
  message: string;
};

/**
 * Database-neutral representation of AnalysisRun V2. This type contains only
 * JSON-safe primitives, arrays, and plain objects. Domain behavior and raw
 * provider payloads do not cross this boundary.
 */
export type AnalysisRunPersistenceRecord = {
  schemaVersion: number;
  revision: number;
  analysisRunId: string;
  creatorId: string;
  channelId: string;
  status: AnalysisRunStatus;
  source: AnalysisRunPersistenceSource;
  adapterMetadata?: AnalysisRunPersistenceAdapterMetadata;
  adapterWarnings: ReadonlyArray<AnalysisRunPersistenceAdapterWarning>;
  pipelineVersion: string;
  analysisResult?: PersistenceJsonObject;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failure?: AnalysisRunPersistenceFailure;
  correlationId?: string;
  attempt: number;
  retryOfAnalysisRunId?: string;
};
