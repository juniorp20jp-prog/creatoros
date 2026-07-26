import {
  validateCreatorDecision,
  type CreatorDecision,
  type DecisionGenerationResult,
} from "../../decisions";
import {
  YOUTUBE_INTELLIGENCE_ENGINE_ID,
  type YouTubeIntelligenceInput,
  type YouTubeIntelligenceOutput,
} from "../../engines";
import {
  validateYouTubeIntelligenceInput,
  YouTubeValidationError,
} from "../../engines/youtube-intelligence/validation";
import type { CreatorIntelligenceResult } from "../../intelligence";
import type {
  EngineExecutionMetadata,
  EngineExecutionResult,
} from "../../types";
import {
  CreatorAnalysisRunPersistenceError,
  type CreatorAnalysisRunPersistenceIssue,
} from "./errors";
import {
  CREATOR_ANALYSIS_RUN_SCHEMA_VERSION,
  type CreatorAnalysisRunParseResult,
  type CreatorAnalysisRunRecord,
} from "./types";

type UnknownRecord = Readonly<Record<string, unknown>>;

function issue(
  path: string,
  code: string,
  message: string,
): CreatorAnalysisRunPersistenceIssue {
  return { path, code, message };
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

function isStringArray(value: unknown): value is ReadonlyArray<string> {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function collectPersistenceSafetyIssues(
  value: unknown,
  path: string,
  ancestors: ReadonlySet<object>,
  issues: Array<CreatorAnalysisRunPersistenceIssue>,
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
      issues.push(issue(path, "non-finite-number", "Numbers must be finite."));
    }
    return;
  }
  if (value === undefined) {
    issues.push(issue(path, "undefined-value", "undefined cannot be persisted."));
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
    issues.push(issue(path, "circular-reference", "Circular references are invalid."));
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
    value.forEach((item, index) =>
      collectPersistenceSafetyIssues(item, `${path}[${index}]`, nextAncestors, issues),
    );
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    collectPersistenceSafetyIssues(item, `${path}.${key}`, nextAncestors, issues);
  }
}

function validateChannelIdentity(
  value: unknown,
  path: string,
  issues: Array<CreatorAnalysisRunPersistenceIssue>,
): value is { id: string; name: string } {
  if (!isPlainObject(value)) {
    issues.push(issue(path, "invalid-object", "Channel identity must be an object."));
    return false;
  }
  if (!isNonEmptyString(value.id)) {
    issues.push(issue(`${path}.id`, "required", "Channel id is required."));
  }
  if (!isNonEmptyString(value.name)) {
    issues.push(issue(`${path}.name`, "required", "Channel name is required."));
  }
  return isNonEmptyString(value.id) && isNonEmptyString(value.name);
}

function hasYouTubeInputShape(value: unknown): value is YouTubeIntelligenceInput {
  if (!isPlainObject(value)) {
    return false;
  }
  const channel = value.channel;
  const context = value.context;
  if (!isPlainObject(channel) || !isPlainObject(context)) {
    return false;
  }
  const period = context.period;
  if (!isPlainObject(period) || !Array.isArray(value.videos)) {
    return false;
  }
  if (
    !isNonEmptyString(channel.id) ||
    !isNonEmptyString(channel.name) ||
    !isFiniteNumber(channel.subscribers) ||
    !isNonEmptyString(context.analysisDate) ||
    !isNonEmptyString(period.startDate) ||
    !isNonEmptyString(period.endDate)
  ) {
    return false;
  }
  if (
    [channel.createdAt, channel.languageOrMarket].some(
      (item) => item !== undefined && typeof item !== "string",
    ) ||
    [channel.totalViews, channel.totalVideos].some(
      (item) => item !== undefined && !isFiniteNumber(item),
    ) ||
    (context.market !== undefined && typeof context.market !== "string")
  ) {
    return false;
  }
  return value.videos.every(
    (video) =>
      isPlainObject(video) &&
      isNonEmptyString(video.id) &&
      isNonEmptyString(video.title) &&
      isNonEmptyString(video.publishedAt) &&
      isFiniteNumber(video.durationSeconds) &&
      isFiniteNumber(video.views),
  );
}

function validateInput(
  value: unknown,
  issues: Array<CreatorAnalysisRunPersistenceIssue>,
): value is YouTubeIntelligenceInput {
  if (!hasYouTubeInputShape(value)) {
    issues.push(
      issue(
        "record.snapshots.input",
        "invalid-analysis-input",
        "Input does not match YouTubeIntelligenceInput.",
      ),
    );
    return false;
  }
  try {
    validateYouTubeIntelligenceInput(value);
  } catch (error) {
    if (error instanceof YouTubeValidationError) {
      issues.push(
        ...error.issues.map((validationIssue) =>
          issue(
            `record.snapshots.input.${validationIssue.field}`,
            validationIssue.code,
            validationIssue.message,
          ),
        ),
      );
    } else {
      issues.push(
        issue(
          "record.snapshots.input",
          "invalid-analysis-input",
          "Input validation failed.",
        ),
      );
    }
    return false;
  }
  return true;
}

function validateExecutionMetadata(
  value: unknown,
  path: string,
  issues: Array<CreatorAnalysisRunPersistenceIssue>,
): value is EngineExecutionMetadata {
  if (!isPlainObject(value)) {
    issues.push(issue(path, "invalid-metadata", "Execution metadata is required."));
    return false;
  }
  const valid =
    isNonEmptyString(value.executionId) &&
    isNonEmptyString(value.engineId) &&
    isCanonicalUtcTimestamp(value.startedAt) &&
    isCanonicalUtcTimestamp(value.finishedAt) &&
    isStringArray(value.providerIds) &&
    isStringArray(value.completedStepIds);
  if (!valid) {
    issues.push(issue(path, "invalid-metadata", "Execution metadata is malformed."));
  }
  return valid;
}

function hasYouTubeOutputShape(value: unknown): value is YouTubeIntelligenceOutput {
  if (!isPlainObject(value)) {
    return false;
  }
  const context = value.context;
  const summary = value.summary;
  const dataQuality = value.dataQuality;
  if (
    !isPlainObject(context) ||
    !isPlainObject(summary) ||
    !isPlainObject(dataQuality) ||
    !Array.isArray(value.videos) ||
    !Array.isArray(value.signals)
  ) {
    return false;
  }
  if (
    !isNonEmptyString(context.analysisDate) ||
    !isPlainObject(summary.channel) ||
    !isNonEmptyString(summary.channel.id) ||
    !isNonEmptyString(summary.channel.name) ||
    !isFiniteNumber(summary.analyzedVideoCount) ||
    !isFiniteNumber(summary.totalViews) ||
    !isPlainObject(dataQuality.fields) ||
    !isStringArray(dataQuality.fields.completelyAvailable) ||
    !isStringArray(dataQuality.fields.partiallyAvailable) ||
    !isStringArray(dataQuality.fields.absent) ||
    !Array.isArray(dataQuality.warnings) ||
    !Array.isArray(dataQuality.limitations) ||
    !Array.isArray(dataQuality.excludedVideos) ||
    !Array.isArray(dataQuality.unevaluatedSignals)
  ) {
    return false;
  }
  return value.videos.every(
    (video) =>
      isPlainObject(video) &&
      isNonEmptyString(video.videoId) &&
      isNonEmptyString(video.title) &&
      isNonEmptyString(video.publishedAt) &&
      isPlainObject(video.metrics) &&
      isPlainObject(video.derivedMetrics) &&
      isPlainObject(video.comparison) &&
      isStringArray(video.availableMetrics),
  );
}

function validateAnalysisResult(
  value: unknown,
  issues: Array<CreatorAnalysisRunPersistenceIssue>,
): value is EngineExecutionResult<YouTubeIntelligenceOutput> {
  const path = "record.snapshots.analysis";
  if (!isPlainObject(value) || (value.status !== "completed" && value.status !== "failed")) {
    issues.push(issue(path, "invalid-analysis-result", "Analysis result is malformed."));
    return false;
  }
  const metadataIsValid = validateExecutionMetadata(
    value.metadata,
    `${path}.metadata`,
    issues,
  );
  if (value.status === "failed") {
    const engineError = value.error;
    const validError =
      isPlainObject(engineError) &&
      isNonEmptyString(engineError.code) &&
      isNonEmptyString(engineError.message) &&
      typeof engineError.retryable === "boolean";
    if (!validError) {
      issues.push(issue(`${path}.error`, "invalid-engine-error", "Engine error is malformed."));
    }
    return metadataIsValid && validError;
  }
  if (!hasYouTubeOutputShape(value.output)) {
    issues.push(
      issue(`${path}.output`, "invalid-analysis-output", "Analysis output is malformed."),
    );
    return false;
  }
  return metadataIsValid;
}

function validateIntelligenceResult(
  value: unknown,
  issues: Array<CreatorAnalysisRunPersistenceIssue>,
): value is CreatorIntelligenceResult | null {
  if (value === null) {
    return true;
  }
  const path = "record.snapshots.intelligence";
  if (!isPlainObject(value) || (value.status !== "success" && value.status !== "failure")) {
    issues.push(issue(path, "invalid-intelligence-result", "Intelligence result is malformed."));
    return false;
  }
  const valid =
    value.status === "failure"
      ? isNonEmptyString(value.reason) &&
        isNonEmptyString(value.errorCode) &&
        isNonEmptyString(value.messageKey) &&
        isPlainObject(value.metadata)
      : isPlainObject(value.brief) &&
        Array.isArray(value.insights) &&
        Array.isArray(value.evidence) &&
        isPlainObject(value.context) &&
        isPlainObject(value.quality) &&
        Array.isArray(value.limitations) &&
        isPlainObject(value.metadata);
  if (!valid) {
    issues.push(issue(path, "invalid-intelligence-result", "Intelligence result is malformed."));
  }
  return valid;
}

function hasCreatorDecisionShape(value: unknown): value is CreatorDecision {
  return (
    isPlainObject(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.ruleId) &&
    isNonEmptyString(value.createdAt) &&
    isPlainObject(value.title) &&
    isPlainObject(value.summary) &&
    isPlainObject(value.observation) &&
    isPlainObject(value.interpretation) &&
    isPlainObject(value.recommendedAction) &&
    isPlainObject(value.expectedImpact) &&
    isPlainObject(value.confidence) &&
    isPlainObject(value.prioritization) &&
    Array.isArray(value.evidence) &&
    Array.isArray(value.alternatives) &&
    Array.isArray(value.metrics)
  );
}

function validateDecisionResult(
  value: unknown,
  issues: Array<CreatorAnalysisRunPersistenceIssue>,
): value is DecisionGenerationResult | null {
  if (value === null) {
    return true;
  }
  const path = "record.snapshots.decisions";
  if (!isPlainObject(value) || (value.status !== "completed" && value.status !== "failed")) {
    issues.push(issue(path, "invalid-decision-result", "Decision result is malformed."));
    return false;
  }
  if (!Array.isArray(value.decisions) || !isPlainObject(value.metadata)) {
    issues.push(issue(path, "invalid-decision-result", "Decision result is malformed."));
    return false;
  }
  const decisionIds = new Set<string>();
  value.decisions.forEach((decision, index) => {
    if (!hasCreatorDecisionShape(decision)) {
      issues.push(
        issue(`${path}.decisions[${index}]`, "invalid-decision", "Decision is malformed."),
      );
      return;
    }
    if (decisionIds.has(decision.id)) {
      issues.push(
        issue(`${path}.decisions[${index}].id`, "duplicate-id", "Decision id is duplicated."),
      );
    }
    decisionIds.add(decision.id);
    issues.push(
      ...validateCreatorDecision(decision).map((validationIssue) =>
        issue(
          `${path}.decisions[${index}].${validationIssue.field}`,
          validationIssue.code,
          validationIssue.message,
        ),
      ),
    );
  });
  if (value.status === "failed" && !Array.isArray(value.issues)) {
    issues.push(issue(`${path}.issues`, "invalid-issues", "Failed results require issues."));
  }
  return true;
}

function validateRecordShape(
  record: UnknownRecord,
): ReadonlyArray<CreatorAnalysisRunPersistenceIssue> {
  const issues: Array<CreatorAnalysisRunPersistenceIssue> = [];
  if (!isNonEmptyString(record.id)) {
    issues.push(issue("record.id", "required", "Record id is required."));
  }
  if (record.status !== "completed" && record.status !== "failed") {
    issues.push(issue("record.status", "invalid-status", "Record status is invalid."));
  }
  if (!isCanonicalUtcTimestamp(record.createdAt)) {
    issues.push(
      issue("record.createdAt", "invalid-timestamp", "createdAt must be canonical UTC ISO 8601."),
    );
  }
  if (!isCanonicalUtcTimestamp(record.updatedAt)) {
    issues.push(
      issue("record.updatedAt", "invalid-timestamp", "updatedAt must be canonical UTC ISO 8601."),
    );
  }
  if (
    isCanonicalUtcTimestamp(record.createdAt) &&
    isCanonicalUtcTimestamp(record.updatedAt) &&
    Date.parse(record.updatedAt) < Date.parse(record.createdAt)
  ) {
    issues.push(
      issue("record.updatedAt", "invalid-date-order", "updatedAt must not precede createdAt."),
    );
  }
  if (!isNonEmptyString(record.locale)) {
    issues.push(issue("record.locale", "required", "Locale is required."));
  }

  const source = record.source;
  let sourceChannel: { id: string; name: string } | null = null;
  if (!isPlainObject(source)) {
    issues.push(issue("record.source", "invalid-source", "Source is required."));
  } else {
    if (source.platform !== "youtube") {
      issues.push(
        issue("record.source.platform", "unsupported-platform", "V1 supports youtube only."),
      );
    }
    sourceChannel = validateChannelIdentity(source.channel, "record.source.channel", issues)
      ? source.channel
      : null;
    if (source.referenceChannel !== null) {
      validateChannelIdentity(
        source.referenceChannel,
        "record.source.referenceChannel",
        issues,
      );
    }
  }

  const snapshots = record.snapshots;
  let input: YouTubeIntelligenceInput | null = null;
  let analysis: EngineExecutionResult<YouTubeIntelligenceOutput> | null = null;
  if (!isPlainObject(snapshots)) {
    issues.push(issue("record.snapshots", "invalid-snapshots", "Snapshots are required."));
  } else {
    input = validateInput(snapshots.input, issues) ? snapshots.input : null;
    analysis = validateAnalysisResult(snapshots.analysis, issues)
      ? snapshots.analysis
      : null;
    validateIntelligenceResult(snapshots.intelligence, issues);
    validateDecisionResult(snapshots.decisions, issues);
  }

  const metadata = record.metadata;
  if (!isPlainObject(metadata)) {
    issues.push(issue("record.metadata", "invalid-metadata", "Run metadata is required."));
  } else {
    if (!isNonEmptyString(metadata.engineId)) {
      issues.push(issue("record.metadata.engineId", "required", "engineId is required."));
    }
    if (!isNonEmptyString(metadata.executionId)) {
      issues.push(
        issue("record.metadata.executionId", "required", "executionId is required."),
      );
    }
    if (metadata.correlationId !== null && !isNonEmptyString(metadata.correlationId)) {
      issues.push(
        issue(
          "record.metadata.correlationId",
          "invalid-correlation-id",
          "correlationId must be null or a non-empty string.",
        ),
      );
    }
    if (
      !isPlainObject(metadata.attributes) ||
      Object.values(metadata.attributes).some((item) => typeof item !== "string")
    ) {
      issues.push(
        issue(
          "record.metadata.attributes",
          "invalid-attributes",
          "Attributes must contain string values.",
        ),
      );
    }
  }

  if (sourceChannel !== null && input !== null) {
    if (
      sourceChannel.id !== input.channel.id ||
      sourceChannel.name !== input.channel.name
    ) {
      issues.push(
        issue(
          "record.source.channel",
          "channel-mismatch",
          "Source channel must match the analysis input channel.",
        ),
      );
    }
  }
  if (analysis !== null) {
    if (record.status !== analysis.status) {
      issues.push(
        issue(
          "record.status",
          "status-mismatch",
          "Record status must match the analysis result.",
        ),
      );
    }
    if (analysis.metadata.engineId !== YOUTUBE_INTELLIGENCE_ENGINE_ID) {
      issues.push(
        issue(
          "record.snapshots.analysis.metadata.engineId",
          "engine-mismatch",
          "Analysis must originate from youtube-intelligence.",
        ),
      );
    }
    if (
      isPlainObject(metadata) &&
      (metadata.engineId !== analysis.metadata.engineId ||
        metadata.executionId !== analysis.metadata.executionId)
    ) {
      issues.push(
        issue(
          "record.metadata",
          "execution-mismatch",
          "Run metadata must match analysis execution metadata.",
        ),
      );
    }
  }
  return issues;
}

export function parseCreatorAnalysisRunRecord(
  value: unknown,
): CreatorAnalysisRunParseResult {
  const safetyIssues: Array<CreatorAnalysisRunPersistenceIssue> = [];
  collectPersistenceSafetyIssues(value, "record", new Set(), safetyIssues);
  if (safetyIssues.length > 0 || !isPlainObject(value)) {
    const issues =
      safetyIssues.length > 0
        ? safetyIssues
        : [issue("record", "invalid-object", "Record must be a plain object.")];
    return {
      status: "invalid",
      error: new CreatorAnalysisRunPersistenceError("invalid-record", issues),
    };
  }

  if (value.schemaVersion !== CREATOR_ANALYSIS_RUN_SCHEMA_VERSION) {
    const isFutureVersion =
      typeof value.schemaVersion === "number" &&
      value.schemaVersion > CREATOR_ANALYSIS_RUN_SCHEMA_VERSION;
    return {
      status: "invalid",
      error: new CreatorAnalysisRunPersistenceError(
        isFutureVersion ? "unsupported-schema-version" : "invalid-record",
        [
          issue(
            "record.schemaVersion",
            isFutureVersion ? "unsupported-version" : "invalid-version",
            `Supported schema version is ${CREATOR_ANALYSIS_RUN_SCHEMA_VERSION}.`,
          ),
        ],
      ),
    };
  }

  const issues = validateRecordShape(value);
  if (issues.length > 0) {
    return {
      status: "invalid",
      error: new CreatorAnalysisRunPersistenceError("invalid-record", issues),
    };
  }
  return {
    status: "valid",
    record: structuredClone(value) as CreatorAnalysisRunRecord,
  };
}
