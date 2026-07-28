import type { AnalysisResult } from "../../engines";
import type { AnalysisRun } from "./analysis-run-model";
import { ANALYSIS_RUN_SCHEMA_VERSION } from "./analysis-run-model";
import type {
  AnalysisRunPersistenceRecord,
  PersistenceJsonObject,
  PersistenceJsonValue,
} from "./analysis-run-persistence-record";

type UnknownRecord = Readonly<Record<string, unknown>>;

export type AnalysisRunPersistenceMappingErrorCode =
  | "invalid-record"
  | "incompatible-schema-version"
  | "invalid-timestamp"
  | "invalid-status-payload"
  | "missing-required-field"
  | "corrupted-record";

export type AnalysisRunPersistenceMappingIssue = {
  path: string;
  code: string;
  message: string;
};

export type AnalysisRunPersistenceMappingError = {
  code: AnalysisRunPersistenceMappingErrorCode;
  issues: ReadonlyArray<AnalysisRunPersistenceMappingIssue>;
};

export type AnalysisRunPersistenceMappingResult<TValue> =
  | {
      status: "success";
      value: TValue;
    }
  | {
      status: "failure";
      error: AnalysisRunPersistenceMappingError;
    };

const recordKeys = [
  "schemaVersion",
  "revision",
  "analysisRunId",
  "creatorId",
  "channelId",
  "status",
  "source",
  "adapterMetadata",
  "adapterWarnings",
  "pipelineVersion",
  "analysisResult",
  "createdAt",
  "updatedAt",
  "completedAt",
  "failure",
  "correlationId",
  "attempt",
  "retryOfAnalysisRunId",
] as const;

function issue(
  path: string,
  code: string,
  message: string,
): AnalysisRunPersistenceMappingIssue {
  return { path, code, message };
}

function success<TValue>(
  value: TValue,
): AnalysisRunPersistenceMappingResult<TValue> {
  return { status: "success", value };
}

function failure<TValue>(
  code: AnalysisRunPersistenceMappingErrorCode,
  issues: ReadonlyArray<AnalysisRunPersistenceMappingIssue>,
): AnalysisRunPersistenceMappingResult<TValue> {
  return {
    status: "failure",
    error: { code, issues },
  };
}

function isPlainObject(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  );
}

function validateAllowedKeys(
  value: UnknownRecord,
  allowed: ReadonlyArray<string>,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push(
        issue(
          `${path}.${key}`,
          "unknown-field",
          "Unknown fields are not allowed in persistence records.",
        ),
      );
    }
  }
}

function validateRequiredString(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  if (!isNonEmptyString(value[key])) {
    issues.push(
      issue(`${path}.${key}`, "required", `${key} is required.`),
    );
    return false;
  }
  return true;
}

function validateOptionalString(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  if (value[key] !== undefined && !isNonEmptyString(value[key])) {
    issues.push(
      issue(
        `${path}.${key}`,
        "invalid-string",
        `${key} must be omitted or a non-empty string.`,
      ),
    );
    return false;
  }
  return true;
}

function validateRequiredNumber(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
  minimum = 0,
): boolean {
  const candidate = value[key];
  if (!isFiniteNumber(candidate) || candidate < minimum) {
    issues.push(
      issue(
        `${path}.${key}`,
        "invalid-number",
        `${key} must be a finite number greater than or equal to ${minimum}.`,
      ),
    );
    return false;
  }
  return true;
}

function validateOptionalNumber(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
  minimum = 0,
): boolean {
  const candidate = value[key];
  if (
    candidate !== undefined &&
    (!isFiniteNumber(candidate) || candidate < minimum)
  ) {
    issues.push(
      issue(
        `${path}.${key}`,
        "invalid-number",
        `${key} must be omitted or a finite number greater than or equal to ${minimum}.`,
      ),
    );
    return false;
  }
  return true;
}

function validateTimestamp(
  value: unknown,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  if (!isCanonicalTimestamp(value)) {
    issues.push(
      issue(
        path,
        "invalid-timestamp",
        "Timestamp must be canonical UTC ISO 8601.",
      ),
    );
    return false;
  }
  return true;
}

function collectSerializationIssues(
  value: unknown,
  path: string,
  ancestors: ReadonlySet<object>,
  issues: AnalysisRunPersistenceMappingIssue[],
): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      issues.push(
        issue(path, "non-finite-number", "Numbers must be finite."),
      );
    }
    return;
  }

  if (value === undefined) {
    issues.push(
      issue(path, "undefined-value", "undefined cannot be persisted."),
    );
    return;
  }

  if (typeof value !== "object") {
    issues.push(
      issue(
        path,
        "non-serializable-value",
        `${typeof value} values cannot be persisted.`,
      ),
    );
    return;
  }

  if (ancestors.has(value)) {
    issues.push(
      issue(path, "circular-reference", "Circular references are invalid."),
    );
    return;
  }

  if (!Array.isArray(value) && !isPlainObject(value)) {
    issues.push(
      issue(
        path,
        "non-plain-object",
        "Only arrays and plain objects can be persisted.",
      ),
    );
    return;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) {
        issues.push(
          issue(
            `${path}[${index}]`,
            "sparse-array",
            "Sparse arrays cannot be persisted.",
          ),
        );
        continue;
      }
      collectSerializationIssues(
        value[index],
        `${path}[${index}]`,
        nextAncestors,
        issues,
      );
    }
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    collectSerializationIssues(
      item,
      `${path}.${key}`,
      nextAncestors,
      issues,
    );
  }
}

function toPersistenceJsonValue(
  value: unknown,
  path: string,
): AnalysisRunPersistenceMappingResult<PersistenceJsonValue> {
  const issues: AnalysisRunPersistenceMappingIssue[] = [];

  function convert(
    current: unknown,
    currentPath: string,
    ancestors: ReadonlySet<object>,
    arrayItem: boolean,
  ): PersistenceJsonValue | undefined {
    if (
      current === null ||
      typeof current === "string" ||
      typeof current === "boolean"
    ) {
      return current;
    }

    if (typeof current === "number") {
      if (Number.isFinite(current)) {
        return current;
      }
      issues.push(
        issue(
          currentPath,
          "non-finite-number",
          "Numbers must be finite.",
        ),
      );
      return undefined;
    }

    if (current === undefined) {
      if (arrayItem) {
        issues.push(
          issue(
            currentPath,
            "undefined-value",
            "Array entries cannot be undefined.",
          ),
        );
      }
      return undefined;
    }

    if (typeof current !== "object") {
      issues.push(
        issue(
          currentPath,
          "non-serializable-value",
          `${typeof current} values cannot be persisted.`,
        ),
      );
      return undefined;
    }

    if (ancestors.has(current)) {
      issues.push(
        issue(
          currentPath,
          "circular-reference",
          "Circular references are invalid.",
        ),
      );
      return undefined;
    }

    if (!Array.isArray(current) && !isPlainObject(current)) {
      issues.push(
        issue(
          currentPath,
          "non-plain-object",
          "Only arrays and plain objects can be persisted.",
        ),
      );
      return undefined;
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(current);
    if (Array.isArray(current)) {
      const values: PersistenceJsonValue[] = [];
      for (let index = 0; index < current.length; index += 1) {
        if (!(index in current)) {
          issues.push(
            issue(
              `${currentPath}[${index}]`,
              "sparse-array",
              "Sparse arrays cannot be persisted.",
            ),
          );
          continue;
        }
        const converted = convert(
          current[index],
          `${currentPath}[${index}]`,
          nextAncestors,
          true,
        );
        if (converted !== undefined) {
          values.push(converted);
        }
      }
      return values;
    }

    const object: Record<string, PersistenceJsonValue> = {};
    for (const [key, item] of Object.entries(current)) {
      const converted = convert(
        item,
        `${currentPath}.${key}`,
        nextAncestors,
        false,
      );
      if (converted !== undefined) {
        object[key] = converted;
      }
    }
    return object;
  }

  const converted = convert(value, path, new Set(), false);
  if (issues.length > 0 || converted === undefined) {
    return failure(
      "corrupted-record",
      issues.length > 0
        ? issues
        : [issue(path, "invalid-value", "Value cannot be persisted.")],
    );
  }
  return success(converted);
}

function validateStringArray(
  value: unknown,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  if (
    !Array.isArray(value) ||
    value.some((item) => !isNonEmptyString(item))
  ) {
    issues.push(
      issue(
        path,
        "invalid-string-array",
        "Value must be an array of non-empty strings.",
      ),
    );
    return false;
  }
  return true;
}

function validateEvidence(
  value: unknown,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  if (!Array.isArray(value)) {
    issues.push(issue(path, "invalid-array", "Evidence must be an array."));
    return false;
  }

  let valid = true;
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(item)) {
      issues.push(
        issue(itemPath, "invalid-object", "Evidence must be an object."),
      );
      valid = false;
      return;
    }
    validateAllowedKeys(item, ["metric", "value"], itemPath, issues);
    valid =
      validateRequiredString(item, "metric", itemPath, issues) &&
      validateRequiredNumber(item, "value", itemPath, issues) &&
      valid;
  });
  return valid;
}

function validateVideoMetrics(
  value: unknown,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  if (!isPlainObject(value)) {
    issues.push(
      issue(path, "invalid-object", "Video metrics must be an object."),
    );
    return false;
  }

  validateAllowedKeys(
    value,
    [
      "videoId",
      "publishedAt",
      "views",
      "likes",
      "comments",
      "durationSeconds",
    ],
    path,
    issues,
  );
  let valid =
    validateRequiredString(value, "videoId", path, issues) &&
    validateTimestamp(value.publishedAt, `${path}.publishedAt`, issues) &&
    validateRequiredNumber(value, "views", path, issues);
  for (const key of ["likes", "comments", "durationSeconds"]) {
    valid = validateOptionalNumber(value, key, path, issues) && valid;
  }
  return valid;
}

function validateChannelMetrics(
  value: unknown,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  if (!isPlainObject(value)) {
    issues.push(
      issue(path, "invalid-object", "Channel metrics must be an object."),
    );
    return false;
  }

  validateAllowedKeys(
    value,
    [
      "channelId",
      "capturedAt",
      "subscriberCount",
      "reportedTotalViews",
      "reportedVideoCount",
      "videos",
      "analyzedVideoCount",
      "analyzedViews",
      "averageViewsPerVideo",
      "averageEngagementRate",
      "averagePublishingIntervalDays",
      "publishingIntervalVariation",
      "subscriberReachRate",
      "dataCompleteness",
    ],
    path,
    issues,
  );
  let valid =
    validateRequiredString(value, "channelId", path, issues) &&
    validateTimestamp(value.capturedAt, `${path}.capturedAt`, issues);
  for (const key of [
    "subscriberCount",
    "analyzedVideoCount",
    "analyzedViews",
    "averageViewsPerVideo",
    "dataCompleteness",
  ]) {
    valid = validateRequiredNumber(value, key, path, issues) && valid;
  }
  for (const key of [
    "reportedTotalViews",
    "reportedVideoCount",
    "averageEngagementRate",
    "averagePublishingIntervalDays",
    "publishingIntervalVariation",
    "subscriberReachRate",
  ]) {
    valid = validateOptionalNumber(value, key, path, issues) && valid;
  }

  if (!Array.isArray(value.videos)) {
    issues.push(
      issue(`${path}.videos`, "invalid-array", "videos must be an array."),
    );
    return false;
  }
  value.videos.forEach((video, index) => {
    valid =
      validateVideoMetrics(video, `${path}.videos[${index}]`, issues) &&
      valid;
  });
  return valid;
}

function validateAnalysisResult(
  value: unknown,
  path: string,
  issues: AnalysisRunPersistenceMappingIssue[],
): value is AnalysisResult {
  if (!isPlainObject(value)) {
    issues.push(
      issue(path, "invalid-object", "Analysis result must be an object."),
    );
    return false;
  }

  validateAllowedKeys(
    value,
    [
      "analysisId",
      "analyzedAt",
      "creator",
      "channel",
      "metrics",
      "scores",
      "opportunities",
      "recommendations",
      "limitations",
    ],
    path,
    issues,
  );
  let valid =
    validateRequiredString(value, "analysisId", path, issues) &&
    validateTimestamp(value.analyzedAt, `${path}.analyzedAt`, issues);

  const creator = value.creator;
  if (!isPlainObject(creator)) {
    issues.push(
      issue(`${path}.creator`, "invalid-object", "creator is required."),
    );
    valid = false;
  } else {
    validateAllowedKeys(
      creator,
      ["id", "displayName", "locale"],
      `${path}.creator`,
      issues,
    );
    valid =
      validateRequiredString(creator, "id", `${path}.creator`, issues) &&
      validateOptionalString(
        creator,
        "displayName",
        `${path}.creator`,
        issues,
      ) &&
      validateOptionalString(creator, "locale", `${path}.creator`, issues) &&
      valid;
  }

  const channel = value.channel;
  if (!isPlainObject(channel)) {
    issues.push(
      issue(`${path}.channel`, "invalid-object", "channel is required."),
    );
    valid = false;
  } else {
    validateAllowedKeys(
      channel,
      [
        "id",
        "creatorId",
        "name",
        "createdAt",
        "language",
        "market",
      ],
      `${path}.channel`,
      issues,
    );
    valid =
      validateRequiredString(channel, "id", `${path}.channel`, issues) &&
      validateRequiredString(
        channel,
        "creatorId",
        `${path}.channel`,
        issues,
      ) &&
      validateOptionalString(channel, "name", `${path}.channel`, issues) &&
      validateOptionalString(
        channel,
        "language",
        `${path}.channel`,
        issues,
      ) &&
      validateOptionalString(channel, "market", `${path}.channel`, issues) &&
      valid;
    if (
      channel.createdAt !== undefined &&
      !validateTimestamp(
        channel.createdAt,
        `${path}.channel.createdAt`,
        issues,
      )
    ) {
      valid = false;
    }
  }

  valid =
    validateChannelMetrics(value.metrics, `${path}.metrics`, issues) &&
    valid;

  if (!Array.isArray(value.scores)) {
    issues.push(
      issue(`${path}.scores`, "invalid-array", "scores must be an array."),
    );
    valid = false;
  } else {
    value.scores.forEach((score, index) => {
      const scorePath = `${path}.scores[${index}]`;
      if (!isPlainObject(score)) {
        issues.push(
          issue(scorePath, "invalid-object", "Score must be an object."),
        );
        valid = false;
        return;
      }
      validateAllowedKeys(
        score,
        ["kind", "value", "availability", "evidence"],
        scorePath,
        issues,
      );
      if (
        !["content", "consistency", "optimization", "growth"].includes(
          String(score.kind),
        ) ||
        !isFiniteNumber(score.value) ||
        score.value < 0 ||
        score.value > 100 ||
        !["calculated", "insufficient-data"].includes(
          String(score.availability),
        ) ||
        !validateEvidence(score.evidence, `${scorePath}.evidence`, issues)
      ) {
        issues.push(
          issue(scorePath, "invalid-score", "Score is malformed."),
        );
        valid = false;
      }
    });
  }

  if (!Array.isArray(value.opportunities)) {
    issues.push(
      issue(
        `${path}.opportunities`,
        "invalid-array",
        "opportunities must be an array.",
      ),
    );
    valid = false;
  } else {
    value.opportunities.forEach((opportunity, index) => {
      const opportunityPath = `${path}.opportunities[${index}]`;
      if (!isPlainObject(opportunity)) {
        issues.push(
          issue(
            opportunityPath,
            "invalid-object",
            "Opportunity must be an object.",
          ),
        );
        valid = false;
        return;
      }
      validateAllowedKeys(
        opportunity,
        ["id", "code", "impact", "evidence"],
        opportunityPath,
        issues,
      );
      if (
        !validateRequiredString(
          opportunity,
          "id",
          opportunityPath,
          issues,
        ) ||
        ![
          "improve-data-coverage",
          "stabilize-publishing-cadence",
          "review-low-reach-content",
        ].includes(String(opportunity.code)) ||
        !["low", "medium", "high"].includes(String(opportunity.impact)) ||
        !validateEvidence(
          opportunity.evidence,
          `${opportunityPath}.evidence`,
          issues,
        )
      ) {
        issues.push(
          issue(
            opportunityPath,
            "invalid-opportunity",
            "Opportunity is malformed.",
          ),
        );
        valid = false;
      }
    });
  }

  if (!Array.isArray(value.recommendations)) {
    issues.push(
      issue(
        `${path}.recommendations`,
        "invalid-array",
        "recommendations must be an array.",
      ),
    );
    valid = false;
  } else {
    value.recommendations.forEach((recommendation, index) => {
      const recommendationPath = `${path}.recommendations[${index}]`;
      if (!isPlainObject(recommendation)) {
        issues.push(
          issue(
            recommendationPath,
            "invalid-object",
            "Recommendation must be an object.",
          ),
        );
        valid = false;
        return;
      }
      validateAllowedKeys(
        recommendation,
        [
          "id",
          "opportunityId",
          "actionCode",
          "rationaleCode",
          "priority",
          "evidenceMetrics",
        ],
        recommendationPath,
        issues,
      );
      const required = [
        "id",
        "opportunityId",
        "actionCode",
        "rationaleCode",
      ].every((key) =>
        validateRequiredString(
          recommendation,
          key,
          recommendationPath,
          issues,
        ),
      );
      if (
        !required ||
        !["low", "medium", "high"].includes(
          String(recommendation.priority),
        ) ||
        !validateStringArray(
          recommendation.evidenceMetrics,
          `${recommendationPath}.evidenceMetrics`,
          issues,
        )
      ) {
        issues.push(
          issue(
            recommendationPath,
            "invalid-recommendation",
            "Recommendation is malformed.",
          ),
        );
        valid = false;
      }
    });
  }

  valid =
    validateStringArray(
      value.limitations,
      `${path}.limitations`,
      issues,
    ) && valid;
  return valid;
}

function validateSource(
  value: unknown,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  const path = "record.source";
  if (!isPlainObject(value)) {
    issues.push(issue(path, "required", "source is required."));
    return false;
  }
  validateAllowedKeys(
    value,
    ["sourceType", "sourceSchemaVersion", "sourceReference"],
    path,
    issues,
  );
  return (
    validateRequiredString(value, "sourceType", path, issues) &&
    validateRequiredString(value, "sourceSchemaVersion", path, issues) &&
    validateOptionalString(value, "sourceReference", path, issues)
  );
}

function validateAdapterMetadata(
  value: unknown,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  const path = "record.adapterMetadata";
  if (!isPlainObject(value)) {
    issues.push(
      issue(path, "invalid-object", "adapterMetadata must be an object."),
    );
    return false;
  }
  validateAllowedKeys(
    value,
    [
      "adapterId",
      "adapterVersion",
      "sourceType",
      "supportedSchemaVersion",
      "processedAt",
    ],
    path,
    issues,
  );
  return (
    validateRequiredString(value, "adapterId", path, issues) &&
    validateRequiredString(value, "adapterVersion", path, issues) &&
    validateRequiredString(value, "sourceType", path, issues) &&
    validateRequiredString(
      value,
      "supportedSchemaVersion",
      path,
      issues,
    ) &&
    validateTimestamp(value.processedAt, `${path}.processedAt`, issues)
  );
}

function validateAdapterWarnings(
  value: unknown,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  const path = "record.adapterWarnings";
  if (!Array.isArray(value)) {
    issues.push(issue(path, "required", "adapterWarnings must be an array."));
    return false;
  }

  let valid = true;
  value.forEach((warning, index) => {
    const warningPath = `${path}[${index}]`;
    if (!isPlainObject(warning)) {
      issues.push(
        issue(warningPath, "invalid-object", "Warning must be an object."),
      );
      valid = false;
      return;
    }
    validateAllowedKeys(
      warning,
      ["severity", "code", "path", "message"],
      warningPath,
      issues,
    );
    if (
      warning.severity !== "warning" ||
      !["MISSING_OPTIONAL_FIELD", "UNKNOWN_FIELD_IGNORED"].includes(
        String(warning.code),
      ) ||
      !validateRequiredString(warning, "path", warningPath, issues) ||
      !validateRequiredString(warning, "message", warningPath, issues)
    ) {
      issues.push(
        issue(warningPath, "invalid-warning", "Warning is malformed."),
      );
      valid = false;
    }
  });
  return valid;
}

function validateFailurePayload(
  value: unknown,
  issues: AnalysisRunPersistenceMappingIssue[],
): boolean {
  const path = "record.failure";
  if (!isPlainObject(value)) {
    issues.push(
      issue(path, "invalid-status-payload", "failure must be an object."),
    );
    return false;
  }
  validateAllowedKeys(value, ["stage", "code", "message"], path, issues);
  let valid = true;
  if (
    !["adapter", "pipeline", "persistence"].includes(
      String(value.stage),
    )
  ) {
    issues.push(
      issue(
        `${path}.stage`,
        "invalid-failure-stage",
        "Failure stage is invalid.",
      ),
    );
    valid = false;
  }
  return (
    validateRequiredString(value, "code", path, issues) &&
    validateRequiredString(value, "message", path, issues) &&
    valid
  );
}

function validateStatusPayload(
  record: UnknownRecord,
  issues: AnalysisRunPersistenceMappingIssue[],
): void {
  const hasResult = record.analysisResult !== undefined;
  const hasFailure = record.failure !== undefined;
  const hasCompletedAt = record.completedAt !== undefined;

  if (record.status === "completed") {
    if (!hasResult || !hasCompletedAt || hasFailure) {
      issues.push(
        issue(
          "record.status",
          "invalid-status-payload",
          "Completed runs require analysisResult and completedAt and cannot contain failure.",
        ),
      );
    }
    if (record.adapterMetadata === undefined) {
      issues.push(
        issue(
          "record.adapterMetadata",
          "invalid-status-payload",
          "Completed runs require adapter metadata.",
        ),
      );
    }
    return;
  }

  if (record.status === "failed") {
    if (!hasFailure || !hasCompletedAt || hasResult) {
      issues.push(
        issue(
          "record.status",
          "invalid-status-payload",
          "Failed runs require failure and completedAt and cannot contain analysisResult.",
        ),
      );
    }
    return;
  }

  if (record.status === "pending" || record.status === "processing") {
    if (
      hasResult ||
      hasFailure ||
      hasCompletedAt ||
      record.adapterMetadata !== undefined ||
      (Array.isArray(record.adapterWarnings) &&
        record.adapterWarnings.length > 0)
    ) {
      issues.push(
        issue(
          "record.status",
          "invalid-status-payload",
          "Non-terminal runs cannot contain terminal or adapter result payloads.",
        ),
      );
    }
    return;
  }

  issues.push(
    issue("record.status", "invalid-status", "Analysis run status is invalid."),
  );
}

function mappingErrorCode(
  issues: ReadonlyArray<AnalysisRunPersistenceMappingIssue>,
): AnalysisRunPersistenceMappingErrorCode {
  if (
    issues.some((item) => item.code.startsWith("invalid-timestamp"))
  ) {
    return "invalid-timestamp";
  }
  if (
    issues.some(
      (item) =>
        item.code === "invalid-status-payload" ||
        item.code === "invalid-status",
    )
  ) {
    return "invalid-status-payload";
  }
  if (issues.some((item) => item.code === "required")) {
    return "missing-required-field";
  }
  if (
    issues.some((item) =>
      [
        "unknown-field",
        "undefined-value",
        "non-finite-number",
        "non-serializable-value",
        "non-plain-object",
        "circular-reference",
        "sparse-array",
      ].includes(item.code),
    )
  ) {
    return "corrupted-record";
  }
  return "invalid-record";
}

function parsePersistenceRecord(
  value: unknown,
): AnalysisRunPersistenceMappingResult<AnalysisRunPersistenceRecord> {
  const safetyIssues: AnalysisRunPersistenceMappingIssue[] = [];
  collectSerializationIssues(value, "record", new Set(), safetyIssues);
  if (safetyIssues.length > 0 || !isPlainObject(value)) {
    return failure(
      "corrupted-record",
      safetyIssues.length > 0
        ? safetyIssues
        : [issue("record", "invalid-object", "Record must be an object.")],
    );
  }

  if (value.schemaVersion !== ANALYSIS_RUN_SCHEMA_VERSION) {
    return failure("incompatible-schema-version", [
      issue(
        "record.schemaVersion",
        "incompatible-schema-version",
        `Supported AnalysisRun schema is ${ANALYSIS_RUN_SCHEMA_VERSION}.`,
      ),
    ]);
  }

  const issues: AnalysisRunPersistenceMappingIssue[] = [];
  validateAllowedKeys(value, recordKeys, "record", issues);
  if (!isPositiveInteger(value.revision)) {
    issues.push(
      issue(
        "record.revision",
        "invalid-revision",
        "revision must be a positive integer.",
      ),
    );
  }
  for (const key of [
    "analysisRunId",
    "creatorId",
    "channelId",
    "pipelineVersion",
  ]) {
    validateRequiredString(value, key, "record", issues);
  }
  validateSource(value.source, issues);
  validateAdapterWarnings(value.adapterWarnings, issues);
  if (value.adapterMetadata !== undefined) {
    validateAdapterMetadata(value.adapterMetadata, issues);
  }
  if (value.failure !== undefined) {
    validateFailurePayload(value.failure, issues);
  }
  validateTimestamp(value.createdAt, "record.createdAt", issues);
  validateTimestamp(value.updatedAt, "record.updatedAt", issues);
  if (value.completedAt !== undefined) {
    validateTimestamp(value.completedAt, "record.completedAt", issues);
  }
  validateOptionalString(value, "correlationId", "record", issues);
  validateOptionalString(
    value,
    "retryOfAnalysisRunId",
    "record",
    issues,
  );
  if (!isPositiveInteger(value.attempt)) {
    issues.push(
      issue(
        "record.attempt",
        "invalid-attempt",
        "attempt must be a positive integer.",
      ),
    );
  }
  validateStatusPayload(value, issues);

  if (value.analysisResult !== undefined) {
    validateAnalysisResult(
      value.analysisResult,
      "record.analysisResult",
      issues,
    );
  }

  if (
    isCanonicalTimestamp(value.createdAt) &&
    isCanonicalTimestamp(value.updatedAt) &&
    Date.parse(value.updatedAt) < Date.parse(value.createdAt)
  ) {
    issues.push(
      issue(
        "record.updatedAt",
        "invalid-timestamp-order",
        "updatedAt must not precede createdAt.",
      ),
    );
  }
  if (
    isCanonicalTimestamp(value.completedAt) &&
    isCanonicalTimestamp(value.updatedAt) &&
    value.completedAt !== value.updatedAt
  ) {
    issues.push(
      issue(
        "record.completedAt",
        "invalid-timestamp-order",
        "completedAt must equal the terminal updatedAt timestamp.",
      ),
    );
  }

  const analysisResult = value.analysisResult;
  if (isPlainObject(analysisResult)) {
    const creator = analysisResult.creator;
    const channel = analysisResult.channel;
    const metrics = analysisResult.metrics;
    if (
      isPlainObject(creator) &&
      creator.id !== value.creatorId
    ) {
      issues.push(
        issue(
          "record.analysisResult.creator.id",
          "identity-mismatch",
          "Analysis creator must match the run creator.",
        ),
      );
    }
    if (
      isPlainObject(channel) &&
      (channel.id !== value.channelId ||
        channel.creatorId !== value.creatorId)
    ) {
      issues.push(
        issue(
          "record.analysisResult.channel",
          "identity-mismatch",
          "Analysis channel identity must match the run.",
        ),
      );
    }
    if (
      isPlainObject(metrics) &&
      metrics.channelId !== value.channelId
    ) {
      issues.push(
        issue(
          "record.analysisResult.metrics.channelId",
          "identity-mismatch",
          "Analysis metrics must match the run channel.",
        ),
      );
    }
  }

  if (issues.length > 0) {
    return failure(mappingErrorCode(issues), issues);
  }

  return success(structuredClone(value) as AnalysisRunPersistenceRecord);
}

export function mapAnalysisRunToPersistenceRecord(
  run: AnalysisRun,
): AnalysisRunPersistenceMappingResult<AnalysisRunPersistenceRecord> {
  let analysisResult: PersistenceJsonObject | undefined;
  if (run.analysisResult !== undefined) {
    const mapped = toPersistenceJsonValue(
      run.analysisResult,
      "run.analysisResult",
    );
    if (mapped.status === "failure") {
      return mapped;
    }
    if (!isPlainObject(mapped.value)) {
      return failure("invalid-record", [
        issue(
          "run.analysisResult",
          "invalid-object",
          "Analysis result must map to a plain object.",
        ),
      ]);
    }
    analysisResult = mapped.value;
  }

  const candidate: AnalysisRunPersistenceRecord = {
    schemaVersion: run.schemaVersion,
    revision: run.revision,
    analysisRunId: run.analysisRunId,
    creatorId: run.creatorId,
    channelId: run.channelId,
    status: run.status,
    source: {
      sourceType: run.source.sourceType,
      sourceSchemaVersion: run.source.sourceSchemaVersion,
      ...(run.source.sourceReference !== undefined
        ? { sourceReference: run.source.sourceReference }
        : {}),
    },
    ...(run.adapterMetadata !== undefined
      ? {
          adapterMetadata: {
            adapterId: run.adapterMetadata.adapterId,
            adapterVersion: run.adapterMetadata.adapterVersion,
            sourceType: run.adapterMetadata.sourceType,
            supportedSchemaVersion:
              run.adapterMetadata.supportedSchemaVersion,
            processedAt: run.adapterMetadata.processedAt,
          },
        }
      : {}),
    adapterWarnings: run.adapterWarnings.map((warning) => ({
      severity: warning.severity,
      code: warning.code,
      path: warning.path,
      message: warning.message,
    })),
    pipelineVersion: run.pipelineVersion,
    ...(analysisResult !== undefined ? { analysisResult } : {}),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    ...(run.completedAt !== undefined
      ? { completedAt: run.completedAt }
      : {}),
    ...(run.failure !== undefined
      ? {
          failure: {
            stage: run.failure.stage,
            code: run.failure.code,
            message: run.failure.message,
          },
        }
      : {}),
    ...(run.correlationId !== undefined
      ? { correlationId: run.correlationId }
      : {}),
    attempt: run.attempt,
    ...(run.retryOfAnalysisRunId !== undefined
      ? { retryOfAnalysisRunId: run.retryOfAnalysisRunId }
      : {}),
  };

  return parsePersistenceRecord(candidate);
}

export function mapPersistenceRecordToAnalysisRun(
  value: unknown,
): AnalysisRunPersistenceMappingResult<AnalysisRun> {
  const parsed = parsePersistenceRecord(value);
  if (parsed.status === "failure") {
    return parsed;
  }

  const record = parsed.value;
  const run: AnalysisRun = {
    schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
    revision: record.revision,
    analysisRunId: record.analysisRunId,
    creatorId: record.creatorId,
    channelId: record.channelId,
    status: record.status,
    source: structuredClone(record.source),
    adapterWarnings: structuredClone(record.adapterWarnings),
    pipelineVersion: record.pipelineVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    attempt: record.attempt,
    ...(record.adapterMetadata !== undefined
      ? { adapterMetadata: structuredClone(record.adapterMetadata) }
      : {}),
    ...(record.analysisResult !== undefined
      ? {
          analysisResult: structuredClone(
            record.analysisResult,
          ) as unknown as AnalysisResult,
        }
      : {}),
    ...(record.completedAt !== undefined
      ? { completedAt: record.completedAt }
      : {}),
    ...(record.failure !== undefined
      ? { failure: structuredClone(record.failure) }
      : {}),
    ...(record.correlationId !== undefined
      ? { correlationId: record.correlationId }
      : {}),
    ...(record.retryOfAnalysisRunId !== undefined
      ? { retryOfAnalysisRunId: record.retryOfAnalysisRunId }
      : {}),
  };

  return success(run);
}
