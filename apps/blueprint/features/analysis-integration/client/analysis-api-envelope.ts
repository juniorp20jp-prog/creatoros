import {
  INTERNAL_ANALYSIS_API_VERSION,
  type InternalAnalysisApiMeta,
  type InternalAnalysisApiSuccess,
} from "../../../server/analysis-api/contracts";
import {
  invalidAnalysisResponseError,
  mapAnalysisHttpError,
} from "./analysis-api-client-error";

export async function parseAnalysisApiResponse<TData>(
  response: Response,
): Promise<TData> {
  let payload: unknown;
  try {
    const text = await response.text();
    payload = text.length === 0
      ? undefined
      : (JSON.parse(text) as unknown);
  } catch {
    throw invalidAnalysisResponseError(response.status);
  }

  if (!isRecord(payload) || !isValidMeta(payload.meta)) {
    throw invalidAnalysisResponseError(response.status);
  }

  if (response.ok) {
    if (!("data" in payload)) {
      throw invalidAnalysisResponseError(response.status);
    }
    const envelope = payload as InternalAnalysisApiSuccess<TData>;
    return envelope.data;
  }

  if (!isValidError(payload.error)) {
    throw invalidAnalysisResponseError(response.status);
  }
  throw mapAnalysisHttpError(response.status);
}

function isValidMeta(value: unknown): value is InternalAnalysisApiMeta {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.apiVersion === INTERNAL_ANALYSIS_API_VERSION &&
    isNonEmptyString(value.requestId) &&
    isCanonicalTimestamp(value.timestamp)
  );
}

function isValidError(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message) &&
    Array.isArray(value.details)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
