import type { StrategicAnalysisProjection } from "./types";
import { STRATEGIC_ANALYSIS_PROJECTION_VERSION } from "./types";

export type StrategicProjectionValidationIssue = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;
const FORBIDDEN_KEYS = new Set([
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authorizationcode",
  "clientsecret",
  "encryptionkey",
  "databaseurl",
  "testdatabaseurl",
  "rawchanneldata",
]);

function object(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function timestamp(value: unknown): value is string {
  return text(value) && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
}
function stringArray(value: unknown): value is ReadonlyArray<string> {
  return Array.isArray(value) && value.every(text);
}
function forbiddenPath(value: unknown, path = "projection"): string | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = forbiddenPath(value[index], `${path}[${index}]`);
      if (found) return found;
    }
  } else if (object(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const normalized = key.replace(/[^a-z]/giu, "").toLowerCase();
      if (FORBIDDEN_KEYS.has(normalized)) return `${path}.${key}`;
      const found = forbiddenPath(nested, `${path}.${key}`);
      if (found) return found;
    }
  }
  return undefined;
}

export function validateStrategicAnalysisProjection(
  value: unknown,
): ReadonlyArray<StrategicProjectionValidationIssue> {
  const issues: StrategicProjectionValidationIssue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  if (!object(value)) return [{ path: "projection", code: "invalid-object", message: "Strategic projection must be an object." }];
  if (value.schemaVersion !== STRATEGIC_ANALYSIS_PROJECTION_VERSION) add("projection.schemaVersion", "incompatible-version", "Strategic projection version is unsupported.");
  if (!timestamp(value.generatedAt)) add("projection.generatedAt", "invalid-timestamp", "generatedAt must be canonical UTC ISO 8601.");

  if (!object(value.provenance)) add("projection.provenance", "invalid-object", "Provenance is required.");
  else {
    if (!text(value.provenance.analysisId)) add("projection.provenance.analysisId", "required", "analysisId is required.");
    if (value.provenance.sourceType !== "connected-youtube") add("projection.provenance.sourceType", "invalid-source", "Source type must be connected-youtube.");
    if (value.provenance.sourceReference !== undefined && !text(value.provenance.sourceReference)) add("projection.provenance.sourceReference", "invalid-string", "sourceReference must be a non-empty string.");
    if (!timestamp(value.provenance.capturedAt)) add("projection.provenance.capturedAt", "invalid-timestamp", "capturedAt must be canonical UTC ISO 8601.");
  }

  if (!object(value.versions) || !text(value.versions.sourceEngine) || !text(value.versions.creatorInterpreter) || !text(value.versions.decisionEngine)) add("projection.versions", "invalid-versions", "All strategic engine versions are required.");
  if (!object(value.sourceIntelligence)) add("projection.sourceIntelligence", "invalid-object", "Source intelligence is required.");
  else if (
    value.sourceIntelligence.provider !== "youtube" ||
    value.sourceIntelligence.engineId !== "youtube-intelligence" ||
    !text(value.sourceIntelligence.executionId) ||
    !object(value.sourceIntelligence.output) ||
    !object(value.sourceIntelligence.output.context) ||
    !object(value.sourceIntelligence.output.summary) ||
    !Array.isArray(value.sourceIntelligence.output.videos) ||
    !Array.isArray(value.sourceIntelligence.output.signals) ||
    !object(value.sourceIntelligence.output.dataQuality)
  ) add("projection.sourceIntelligence", "invalid-source-intelligence", "Source intelligence contract is malformed.");

  if (!object(value.creatorIntelligence) || (value.creatorIntelligence.status !== "success" && value.creatorIntelligence.status !== "failure")) add("projection.creatorIntelligence", "invalid-intelligence", "Creator intelligence result is malformed.");
  if (!object(value.decisions) || (value.decisions.status !== "completed" && value.decisions.status !== "failed") || !Array.isArray(value.decisions.decisions) || !object(value.decisions.metadata)) add("projection.decisions", "invalid-decisions", "Decision result is malformed.");
  if (!object(value.dataQuality)) add("projection.dataQuality", "invalid-data-quality", "Data quality is required.");
  if (!stringArray(value.limitations)) add("projection.limitations", "invalid-string-array", "Limitations must be an array of non-empty strings.");
  const unsafe = forbiddenPath(value);
  if (unsafe) add(unsafe, "forbidden-sensitive-field", "Sensitive or raw provider fields are not allowed.");
  return issues;
}

export function isStrategicAnalysisProjection(value: unknown): value is StrategicAnalysisProjection {
  return validateStrategicAnalysisProjection(value).length === 0;
}