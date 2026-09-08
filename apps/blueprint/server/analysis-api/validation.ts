import type {
  AnalysisQueryFilters,
  AnalysisReadStatus,
  ListAnalysisRunsQuery,
} from "../../core";
import type {
  InternalAnalysisApiValidationDetail,
  ReplayAnalysisRequest,
  RunAnalysisRequest,
} from "./contracts";

export const MAX_INTERNAL_ANALYSIS_BODY_BYTES = 16_384;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FIXTURE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,4096}$/;
const statuses: ReadonlyArray<AnalysisReadStatus> = [
  "pending",
  "processing",
  "completed",
  "partial",
  "failed",
];

export type ValidationResult<TValue> =
  | { status: "valid"; value: TValue }
  | {
      status: "invalid";
      code:
        | "INVALID_JSON"
        | "INVALID_REQUEST"
        | "PAYLOAD_TOO_LARGE";
      details: ReadonlyArray<InternalAnalysisApiValidationDetail>;
    };

export async function parseRunAnalysisRequest(
  request: Request,
): Promise<ValidationResult<RunAnalysisRequest>> {
  const body = await parseJsonObject(request);
  if (body.status === "invalid") return body;
  const source = body.value.source;
  if (source === "connected-youtube") {
    return validateStrictObject(
      body.value,
      ["source", "correlationId", "analysisRunId"],
      (value, issues) => {
        const correlationId = optionalIdentifier(value, "correlationId", issues);
        const analysisRunId = optionalIdentifier(value, "analysisRunId", issues);
        return {
          source: "connected-youtube" as const,
          ...(correlationId ? { correlationId } : {}),
          ...(analysisRunId ? { analysisRunId } : {}),
        };
      },
    );
  }
  return validateStrictObject(
    body.value,
    ["source", "fixtureId", "creatorId", "channelId", "correlationId", "analysisRunId"],
    (value, issues) => {
      if (source !== undefined && source !== "fixture") {
        issues.push(issue("$.source", "INVALID_VALUE", "source must be connected-youtube or fixture."));
      }
      const fixtureId = requiredString(value, "fixtureId", FIXTURE_ID_PATTERN, issues);
      const creatorId = requiredIdentifier(value, "creatorId", issues);
      const channelId = requiredIdentifier(value, "channelId", issues);
      const correlationId = optionalIdentifier(value, "correlationId", issues);
      const analysisRunId = optionalIdentifier(value, "analysisRunId", issues);
      return fixtureId && creatorId && channelId
        ? {
            ...(source === "fixture" ? { source: "fixture" as const } : {}),
            fixtureId,
            creatorId,
            channelId,
            ...(correlationId ? { correlationId } : {}),
            ...(analysisRunId ? { analysisRunId } : {}),
          }
        : undefined;
    },
  );
}
export async function parseReplayAnalysisRequest(
  request: Request,
): Promise<ValidationResult<ReplayAnalysisRequest>> {
  const body = await parseJsonObject(request);
  if (body.status === "invalid") return body;
  const source = body.value.source;
  if (source === "connected-youtube") {
    return validateStrictObject(
      body.value,
      ["source", "correlationId", "newAnalysisRunId"],
      (value, issues) => {
        const correlationId = optionalIdentifier(value, "correlationId", issues);
        const newAnalysisRunId = optionalIdentifier(value, "newAnalysisRunId", issues);
        return {
          source: "connected-youtube" as const,
          ...(correlationId ? { correlationId } : {}),
          ...(newAnalysisRunId ? { newAnalysisRunId } : {}),
        };
      },
    );
  }
  return validateStrictObject(
    body.value,
    ["source", "fixtureId", "correlationId", "newAnalysisRunId"],
    (value, issues) => {
      if (source !== undefined && source !== "fixture") {
        issues.push(issue("$.source", "INVALID_VALUE", "source must be connected-youtube or fixture."));
      }
      const fixtureId = requiredString(value, "fixtureId", FIXTURE_ID_PATTERN, issues);
      const correlationId = optionalIdentifier(value, "correlationId", issues);
      const newAnalysisRunId = optionalIdentifier(value, "newAnalysisRunId", issues);
      return fixtureId
        ? {
            ...(source === "fixture" ? { source: "fixture" as const } : {}),
            fixtureId,
            ...(correlationId ? { correlationId } : {}),
            ...(newAnalysisRunId ? { newAnalysisRunId } : {}),
          }
        : undefined;
    },
  );
}
export function parseAnalysisRunId(
  value: string,
): ValidationResult<string> {
  const normalized = value.trim();
  return IDENTIFIER_PATTERN.test(normalized)
    ? { status: "valid", value: normalized }
    : invalid("INVALID_REQUEST", [
        issue(
          "$.analysisRunId",
          "INVALID_IDENTIFIER",
          "analysisRunId must be a valid non-empty identifier.",
        ),
      ]);
}

export function parseListAnalysisQuery(
  request: Request,
): ValidationResult<ListAnalysisRunsQuery> {
  const searchParams = new URL(request.url).searchParams;
  const allowed = [
    "source",
    "creatorId",
    "channelId",
    "status",
    "from",
    "to",
    "attempt",
    "analysisId",
    "cursor",
    "limit",
  ] as const;
  const issues = validateSearchParams(searchParams, allowed);
  const connectedSource = searchParams.get("source") === "connected-youtube";
  const channelId = queryIdentifier(
    searchParams,
    "channelId",
    !connectedSource,
    issues,
  );
  const creatorId = queryIdentifier(
    searchParams,
    "creatorId",
    false,
    issues,
  );
  const analysisId = queryIdentifier(
    searchParams,
    "analysisId",
    false,
    issues,
  );
  const status = queryStatus(searchParams, issues);
  const createdFrom = queryTimestamp(
    searchParams,
    "from",
    issues,
  );
  const createdTo = queryTimestamp(
    searchParams,
    "to",
    issues,
  );
  const attempt = queryPositiveInteger(
    searchParams,
    "attempt",
    undefined,
    issues,
  );
  const pageSize = queryPositiveInteger(
    searchParams,
    "limit",
    100,
    issues,
  );
  const cursor = searchParams.get("cursor") ?? undefined;
  if (cursor !== undefined && !CURSOR_PATTERN.test(cursor)) {
    issues.push(
      issue(
        "$.query.cursor",
        "INVALID_CURSOR",
        "cursor must be an opaque base64url value.",
      ),
    );
  }
  if (createdFrom && createdTo && createdFrom > createdTo) {
    issues.push(
      issue(
        "$.query",
        "INVALID_DATE_RANGE",
        "from must be before or equal to to.",
      ),
    );
  }
  if ((!channelId && !connectedSource) || issues.length > 0) {
    return invalid("INVALID_REQUEST", issues);
  }
  const filters: AnalysisQueryFilters = {
    channelId: channelId ?? "__connected_youtube__",
    ...(creatorId ? { creatorId } : {}),
    ...(analysisId ? { analysisId } : {}),
    ...(status ? { status } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdTo ? { createdTo } : {}),
    ...(attempt !== undefined ? { attempt } : {}),
  };
  return {
    status: "valid",
    value: {
      filters,
      ...(pageSize !== undefined ? { pageSize } : {}),
      ...(cursor ? { cursor } : {}),
    },
  };
}

export function parseStatusSummaryQuery(
  request: Request,
): ValidationResult<{ filters: AnalysisQueryFilters }> {
  const parsed = parseListAnalysisQuery(request);
  if (parsed.status === "invalid") {
    return parsed;
  }
  if (parsed.value.cursor || parsed.value.pageSize !== undefined) {
    return invalid("INVALID_REQUEST", [
      issue(
        "$.query",
        "UNSUPPORTED_SUMMARY_PARAMETER",
        "cursor and limit are not supported by status-summary.",
      ),
    ]);
  }
  return {
    status: "valid",
    value: { filters: parsed.value.filters },
  };
}

export function parseDeleteAnalysisQuery(
  request: Request,
): ValidationResult<{ expectedRevision?: number }> {
  const searchParams = new URL(request.url).searchParams;
  const issues = validateSearchParams(searchParams, [
    "expectedRevision",
  ] as const);
  const expectedRevision = queryPositiveInteger(
    searchParams,
    "expectedRevision",
    undefined,
    issues,
  );
  return issues.length > 0
    ? invalid("INVALID_REQUEST", issues)
    : {
        status: "valid",
        value:
          expectedRevision === undefined
            ? {}
            : { expectedRevision },
      };
}

async function parseJsonObject(
  request: Request,
): Promise<ValidationResult<Record<string, unknown>>> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > MAX_INTERNAL_ANALYSIS_BODY_BYTES
  ) {
    return invalid("PAYLOAD_TOO_LARGE", [
      issue(
        "$",
        "PAYLOAD_TOO_LARGE",
        `Request body must not exceed ${MAX_INTERNAL_ANALYSIS_BODY_BYTES} bytes.`,
      ),
    ]);
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return invalid("INVALID_JSON", [
      issue("$", "UNREADABLE_BODY", "Request body could not be read."),
    ]);
  }
  if (
    new TextEncoder().encode(text).byteLength >
    MAX_INTERNAL_ANALYSIS_BODY_BYTES
  ) {
    return invalid("PAYLOAD_TOO_LARGE", [
      issue(
        "$",
        "PAYLOAD_TOO_LARGE",
        `Request body must not exceed ${MAX_INTERNAL_ANALYSIS_BODY_BYTES} bytes.`,
      ),
    ]);
  }
  if (text.trim().length === 0) {
    return invalid("INVALID_JSON", [
      issue("$", "EMPTY_BODY", "A JSON request body is required."),
    ]);
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return invalid("INVALID_JSON", [
      issue("$", "MALFORMED_JSON", "Request body must contain valid JSON."),
    ]);
  }
  if (!isRecord(value)) {
    return invalid("INVALID_REQUEST", [
      issue("$", "INVALID_BODY", "Request body must be a JSON object."),
    ]);
  }
  return { status: "valid", value };
}

function validateStrictObject<TValue>(
  value: Record<string, unknown>,
  allowedKeys: ReadonlyArray<string>,
  build: (
    input: Record<string, unknown>,
    issues: InternalAnalysisApiValidationDetail[],
  ) => TValue | undefined,
): ValidationResult<TValue> {
  const issues: InternalAnalysisApiValidationDetail[] = [];
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(
        issue(
          `$.${key}`,
          "UNKNOWN_PROPERTY",
          "Property is not allowed.",
        ),
      );
    }
  }
  const result = build(value, issues);
  return result !== undefined && issues.length === 0
    ? { status: "valid", value: result }
    : invalid("INVALID_REQUEST", issues);
}

function requiredIdentifier(
  value: Record<string, unknown>,
  key: string,
  issues: InternalAnalysisApiValidationDetail[],
): string | undefined {
  return requiredString(value, key, IDENTIFIER_PATTERN, issues);
}

function optionalIdentifier(
  value: Record<string, unknown>,
  key: string,
  issues: InternalAnalysisApiValidationDetail[],
): string | undefined {
  if (value[key] === undefined) {
    return undefined;
  }
  return requiredString(value, key, IDENTIFIER_PATTERN, issues);
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  pattern: RegExp,
  issues: InternalAnalysisApiValidationDetail[],
): string | undefined {
  const candidate = value[key];
  if (typeof candidate !== "string") {
    issues.push(
      issue(`$.${key}`, "INVALID_TYPE", `${key} must be a string.`),
    );
    return undefined;
  }
  const normalized = candidate.trim();
  if (!pattern.test(normalized)) {
    issues.push(
      issue(
        `$.${key}`,
        "INVALID_VALUE",
        `${key} has an invalid format.`,
      ),
    );
    return undefined;
  }
  return normalized;
}

function validateSearchParams<const TAllowed extends string>(
  searchParams: URLSearchParams,
  allowed: ReadonlyArray<TAllowed>,
): InternalAnalysisApiValidationDetail[] {
  const issues: InternalAnalysisApiValidationDetail[] = [];
  const names = new Set(searchParams.keys());
  for (const name of names) {
    if (!allowed.includes(name as TAllowed)) {
      issues.push(
        issue(
          `$.query.${name}`,
          "UNKNOWN_QUERY_PARAMETER",
          "Query parameter is not allowed.",
        ),
      );
    }
    if (searchParams.getAll(name).length > 1) {
      issues.push(
        issue(
          `$.query.${name}`,
          "DUPLICATE_QUERY_PARAMETER",
          "Query parameter must appear at most once.",
        ),
      );
    }
  }
  return issues;
}

function queryIdentifier(
  searchParams: URLSearchParams,
  name: string,
  required: boolean,
  issues: InternalAnalysisApiValidationDetail[],
): string | undefined {
  const value = searchParams.get(name);
  if (value === null) {
    if (required) {
      issues.push(
        issue(
          `$.query.${name}`,
          "MISSING_QUERY_PARAMETER",
          `${name} is required.`,
        ),
      );
    }
    return undefined;
  }
  const normalized = value.trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    issues.push(
      issue(
        `$.query.${name}`,
        "INVALID_IDENTIFIER",
        `${name} has an invalid format.`,
      ),
    );
    return undefined;
  }
  return normalized;
}

function queryStatus(
  searchParams: URLSearchParams,
  issues: InternalAnalysisApiValidationDetail[],
): AnalysisReadStatus | undefined {
  const value = searchParams.get("status");
  if (value === null) {
    return undefined;
  }
  if (!statuses.includes(value as AnalysisReadStatus)) {
    issues.push(
      issue(
        "$.query.status",
        "INVALID_STATUS",
        "status is not supported.",
      ),
    );
    return undefined;
  }
  return value as AnalysisReadStatus;
}

function queryTimestamp(
  searchParams: URLSearchParams,
  name: "from" | "to",
  issues: InternalAnalysisApiValidationDetail[],
): string | undefined {
  const value = searchParams.get(name);
  if (value === null) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== value
  ) {
    issues.push(
      issue(
        `$.query.${name}`,
        "INVALID_TIMESTAMP",
        `${name} must be a canonical ISO 8601 UTC timestamp.`,
      ),
    );
    return undefined;
  }
  return value;
}

function queryPositiveInteger(
  searchParams: URLSearchParams,
  name: string,
  maximum: number | undefined,
  issues: InternalAnalysisApiValidationDetail[],
): number | undefined {
  const value = searchParams.get(name);
  if (value === null) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    issues.push(
      issue(
        `$.query.${name}`,
        "INVALID_INTEGER",
        `${name} must be a positive integer.`,
      ),
    );
    return undefined;
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    (maximum !== undefined && parsed > maximum)
  ) {
    issues.push(
      issue(
        `$.query.${name}`,
        "INVALID_INTEGER",
        `${name} must be a positive integer${
          maximum === undefined ? "" : ` no greater than ${maximum}`
        }.`,
      ),
    );
    return undefined;
  }
  return parsed;
}

function issue(
  path: string,
  code: string,
  message: string,
): InternalAnalysisApiValidationDetail {
  return { path, code, message };
}

function invalid<TValue>(
  code: "INVALID_JSON" | "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE",
  details: ReadonlyArray<InternalAnalysisApiValidationDetail>,
): ValidationResult<TValue> {
  return { status: "invalid", code, details };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
