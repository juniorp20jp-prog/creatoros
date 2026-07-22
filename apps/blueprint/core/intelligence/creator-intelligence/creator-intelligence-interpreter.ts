import type {
  YouTubeDataQuality,
  YouTubeIntelligenceOutput,
  YouTubeIntelligenceSignal,
  YouTubeSignalCode,
  YouTubeSignalConfidence,
} from "../../engines/youtube-intelligence";
import type { EngineExecutionResult } from "../../types";
import {
  CREATOR_INTELLIGENCE_INTERPRETER_VERSION,
  type BriefStatement,
  type CreatorInsight,
  type CreatorInsightCategory,
  type CreatorInsightPriority,
  type CreatorIntelligenceFailure,
  type CreatorIntelligenceResult,
  type EvidenceBlock,
  type EvidenceKind,
  type EvidenceUnit,
  type ExecutiveBrief,
  type IntelligenceAnalysisContext,
  type IntelligenceLimitation,
  type IntelligenceQuality,
  type IntelligenceQualityStatus,
  type IntelligenceStatus,
} from "./types";

const MAXIMUM_BRIEF_STATEMENTS = 3;

const SIGNAL_CATEGORIES = {
  "publication-inconsistency": "risk",
  "view-concentration": "risk",
  "above-median-performance": "opportunity",
  "relative-high-ctr": "opportunity",
  "relative-low-ctr": "risk",
  "relative-high-retention": "opportunity",
  "relative-low-retention": "risk",
  "relative-high-engagement": "opportunity",
  "relative-low-engagement": "risk",
  "publication-frequency-change": "pattern",
  "duration-performance-association": "pattern",
  "recurring-title-terms": "finding",
} as const satisfies Record<YouTubeSignalCode, CreatorInsightCategory>;

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
} as const satisfies Record<CreatorInsightPriority, number>;

const CATEGORY_ORDER = {
  risk: 0,
  opportunity: 1,
  pattern: 2,
  finding: 3,
  "data-quality": 4,
} as const satisfies Record<CreatorInsightCategory, number>;

const CONFIDENCE_ORDER: Record<YouTubeSignalConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function failure(
  result: EngineExecutionResult<YouTubeIntelligenceOutput>,
  reason: CreatorIntelligenceFailure["reason"],
  errorCode: string,
): CreatorIntelligenceFailure {
  return {
    status: "failure",
    reason,
    errorCode,
    messageKey: `states.failures.${reason}`,
    metadata: {
      sourceEngineId: result.metadata.engineId,
      sourceExecutionId: result.metadata.executionId,
      generatedAt:
        result.status === "completed" && isCompatibleOutput(result.output)
          ? result.output.context.analysisDate
          : null,
      interpreterVersion: CREATOR_INTELLIGENCE_INTERPRETER_VERSION,
    },
  };
}

function isCompatibleOutput(value: unknown): value is YouTubeIntelligenceOutput {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const output = value as Readonly<Record<string, unknown>>;
  return (
    output.context !== null &&
    typeof output.context === "object" &&
    output.summary !== null &&
    typeof output.summary === "object" &&
    Array.isArray(output.videos) &&
    Array.isArray(output.signals) &&
    output.dataQuality !== null &&
    typeof output.dataQuality === "object"
  );
}

function qualityStatus(quality: YouTubeDataQuality): IntelligenceQualityStatus {
  if (quality.effectiveVideoCount < 3) {
    return "limited";
  }

  if (
    quality.fields.partiallyAvailable.length > 0 ||
    quality.fields.absent.length > 0 ||
    quality.warnings.length > 0 ||
    quality.excludedVideos.length > 0 ||
    quality.unevaluatedSignals.some(
      (signal) =>
        signal.reason === "metric-unavailable" ||
        signal.reason === "insufficient-sample",
    )
  ) {
    return "partial";
  }

  return "complete";
}

function evidenceUnit(
  signal: YouTubeIntelligenceSignal,
  key: string,
): EvidenceUnit {
  if (
    key.includes("Share") ||
    key === "coefficientOfVariation" ||
    key === "relativeDifference" ||
    key === "maximumVideoShare"
  ) {
    return "ratio";
  }
  if (key.includes("IntervalDays")) {
    return "days";
  }
  if (key.includes("Seconds")) {
    return "seconds";
  }
  if (key === "channelMetricMedian") {
    if (signal.code.includes("ctr") || signal.code.includes("retention")) {
      return "percentage-points";
    }
    if (signal.code.includes("engagement")) {
      return "ratio";
    }
  }
  if (
    key.includes("Count") ||
    key.includes("Size") ||
    key === "intervalCount"
  ) {
    return "count";
  }
  return "decimal";
}

function evidenceKind(key: string): EvidenceKind {
  if (key.includes("Share")) {
    return "concentration";
  }
  if (key.includes("Count") || key.includes("Size")) {
    return "sample";
  }
  if (
    key.includes("Ratio") ||
    key.includes("Difference") ||
    key.includes("Median")
  ) {
    return "comparison";
  }
  return "metric";
}

function signalEvidence(
  signal: YouTubeIntelligenceSignal,
): ReadonlyArray<EvidenceBlock> {
  return Object.entries(signal.evidence).map(([key, value]) => ({
    id: `evidence.signal.${signal.code}.${key}`,
    kind: evidenceKind(key),
    labelKey: `evidence.labels.${key}`,
    value,
    unit: evidenceUnit(signal, key),
    sourceRef: `signals.${signal.code}.evidence.${key}`,
  }));
}

function priorityForSignal(
  signal: YouTubeIntelligenceSignal,
): CreatorInsightPriority {
  const category = SIGNAL_CATEGORIES[signal.code];
  if (
    signal.confidence === "high" &&
    (signal.impact === "high" || category === "risk")
  ) {
    return "high";
  }
  if (
    signal.impact === "high" ||
    (signal.impact === "medium" && signal.confidence !== "low") ||
    signal.confidence === "high"
  ) {
    return "medium";
  }
  return "low";
}

function signalSampleSize(
  signal: YouTubeIntelligenceSignal,
  fallback: number,
): number {
  return (
    signal.evidence.eligibleVideoCount ??
    signal.evidence.sampleSize ??
    fallback
  );
}

function signalLimitations(
  signal: YouTubeIntelligenceSignal,
  quality: YouTubeDataQuality,
): ReadonlyArray<string> {
  const limitations: Array<string> = [];
  if (signal.confidence === "low") {
    limitations.push("low-confidence");
  }
  if (
    quality.fields.partiallyAvailable.length > 0 ||
    quality.fields.absent.length > 0
  ) {
    limitations.push("partial-data");
  }
  return limitations;
}

function insightFromSignal(
  signal: YouTubeIntelligenceSignal,
  quality: YouTubeDataQuality,
): CreatorInsight {
  return {
    id: `insight.youtube.${signal.code}`,
    category: SIGNAL_CATEGORIES[signal.code],
    priority: priorityForSignal(signal),
    titleKey: `insights.codes.${signal.code}.title`,
    descriptionKey: `insights.codes.${signal.code}.description`,
    parameters: signal.explanation.parameters,
    confidence: signal.confidence,
    evidence: signalEvidence(signal),
    sampleSize: signalSampleSize(signal, quality.effectiveVideoCount),
    limitations: signalLimitations(signal, quality),
    sourceSignalIds: [signal.code],
    relatedVideoIds: signal.relatedVideoIds,
    relatedTerms: signal.relatedTerms ?? [],
  };
}

function dataQualityInsight(
  quality: YouTubeDataQuality,
  status: IntelligenceQualityStatus,
): CreatorInsight | null {
  if (
    status === "complete" &&
    quality.warnings.length === 0 &&
    quality.excludedVideos.length === 0
  ) {
    return null;
  }

  const missingFieldCount =
    quality.fields.partiallyAvailable.length + quality.fields.absent.length;
  const evidence: ReadonlyArray<EvidenceBlock> = [
    {
      id: "evidence.quality.effectiveVideoCount",
      kind: "sample",
      labelKey: "evidence.labels.effectiveVideoCount",
      value: quality.effectiveVideoCount,
      unit: "count",
      sourceRef: "dataQuality.effectiveVideoCount",
    },
    {
      id: "evidence.quality.missingFieldCount",
      kind: "availability",
      labelKey: "evidence.labels.missingFieldCount",
      value: missingFieldCount,
      unit: "count",
      sourceRef: "dataQuality.fields",
    },
    {
      id: "evidence.quality.unevaluatedSignalCount",
      kind: "availability",
      labelKey: "evidence.labels.unevaluatedSignalCount",
      value: quality.unevaluatedSignals.length,
      unit: "count",
      sourceRef: "dataQuality.unevaluatedSignals",
    },
  ];

  return {
    id: "insight.youtube.data-quality",
    category: "data-quality",
    priority: status === "limited" ? "high" : "medium",
    titleKey: `insights.dataQuality.${status}.title`,
    descriptionKey: `insights.dataQuality.${status}.description`,
    parameters: {
      sampleSize: quality.effectiveVideoCount,
      missingFieldCount,
      unevaluatedSignalCount: quality.unevaluatedSignals.length,
    },
    confidence: null,
    evidence,
    sampleSize: quality.effectiveVideoCount,
    limitations: [
      status === "limited" ? "insufficient-sample" : "partial-data",
    ],
    sourceSignalIds: [],
    relatedVideoIds: quality.excludedVideos.map((video) => video.videoId),
    relatedTerms: [],
  };
}

function compareInsights(left: CreatorInsight, right: CreatorInsight): number {
  return (
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category] ||
    (left.confidence === null ? 3 : CONFIDENCE_ORDER[left.confidence]) -
      (right.confidence === null ? 3 : CONFIDENCE_ORDER[right.confidence]) ||
    left.id.localeCompare(right.id)
  );
}

function contextEvidence(quality: YouTubeDataQuality): ReadonlyArray<EvidenceBlock> {
  return [
    {
      id: "evidence.context.inputVideoCount",
      kind: "sample",
      labelKey: "evidence.labels.inputVideoCount",
      value: quality.inputVideoCount,
      unit: "count",
      sourceRef: "dataQuality.inputVideoCount",
    },
    {
      id: "evidence.context.effectiveVideoCount",
      kind: "sample",
      labelKey: "evidence.labels.effectiveVideoCount",
      value: quality.effectiveVideoCount,
      unit: "count",
      sourceRef: "dataQuality.effectiveVideoCount",
    },
    {
      id: "evidence.context.excludedVideoCount",
      kind: "sample",
      labelKey: "evidence.labels.excludedVideoCount",
      value: quality.excludedVideos.length,
      unit: "count",
      sourceRef: "dataQuality.excludedVideos.length",
    },
  ];
}

function intelligenceStatus(
  quality: IntelligenceQualityStatus,
  insights: ReadonlyArray<CreatorInsight>,
): IntelligenceStatus {
  if (quality === "limited") {
    return "limited";
  }
  if (
    quality === "partial" ||
    insights.some(
      (insight) =>
        insight.priority === "high" &&
        (insight.category === "risk" || insight.category === "data-quality"),
    )
  ) {
    return "attention";
  }
  return quality === "complete" ? "healthy" : "unknown";
}

function createBrief(
  quality: IntelligenceQualityStatus,
  insights: ReadonlyArray<CreatorInsight>,
  context: IntelligenceAnalysisContext,
): ExecutiveBrief {
  const status = intelligenceStatus(quality, insights);
  const leadInsight = insights[0] ?? null;
  const headline: BriefStatement = {
    id: "brief.headline",
    messageKey: `brief.headlines.${status}`,
    parameters: {
      channelName: context.channel.name,
      sampleSize: context.effectiveSampleSize,
    },
    evidenceRefs:
      leadInsight?.evidence.map((evidence) => evidence.id) ?? [
        "evidence.context.effectiveVideoCount",
      ],
    confidence: leadInsight?.confidence ?? null,
  };

  const summary: Array<BriefStatement> = [
    {
      id: "brief.summary.sample",
      messageKey: "brief.summary.sample",
      parameters: {
        includedVideoCount: context.includedVideoCount,
        inputVideoCount: context.inputVideoCount,
        excludedVideoCount: context.excludedVideoCount,
      },
      evidenceRefs: [
        "evidence.context.inputVideoCount",
        "evidence.context.effectiveVideoCount",
        "evidence.context.excludedVideoCount",
      ],
      confidence: null,
    },
  ];

  if (insights.length === 0) {
    summary.push({
      id: "brief.summary.no-supported-insights",
      messageKey: "brief.summary.noSupportedInsights",
      parameters: { sampleSize: context.effectiveSampleSize },
      evidenceRefs: ["evidence.context.effectiveVideoCount"],
      confidence: null,
    });
  } else {
    for (const insight of insights.slice(0, MAXIMUM_BRIEF_STATEMENTS - 1)) {
      summary.push({
        id: `brief.summary.${insight.id}`,
        messageKey: insight.descriptionKey,
        parameters: insight.parameters,
        evidenceRefs: insight.evidence.map((evidence) => evidence.id),
        confidence: insight.confidence,
      });
    }
  }

  return {
    headline,
    summary: summary.slice(0, MAXIMUM_BRIEF_STATEMENTS),
    status,
    confidence: leadInsight?.confidence ?? null,
  };
}

function createContext(output: YouTubeIntelligenceOutput): IntelligenceAnalysisContext {
  return {
    channel: {
      id: output.summary.channel.id,
      name: output.summary.channel.name,
    },
    requestedPeriod: output.summary.requestedPeriod,
    coveredPeriod: output.summary.coveredPeriod ?? null,
    inputVideoCount: output.dataQuality.inputVideoCount,
    includedVideoCount: output.summary.analyzedVideoCount,
    excludedVideoCount: output.dataQuality.excludedVideos.length,
    effectiveSampleSize: output.dataQuality.effectiveVideoCount,
    generatedAt: output.context.analysisDate,
    availableMetrics: output.dataQuality.fields.completelyAvailable,
  };
}

function createQuality(
  quality: YouTubeDataQuality,
  status: IntelligenceQualityStatus,
): IntelligenceQuality {
  return {
    status,
    fields: quality.fields,
    sampleSize: quality.effectiveVideoCount,
    warnings: quality.warnings,
    exclusions: quality.excludedVideos,
    unevaluatedSignals: quality.unevaluatedSignals,
    insufficientMetricCount:
      quality.fields.partiallyAvailable.length + quality.fields.absent.length,
  };
}

function createLimitations(
  quality: YouTubeDataQuality,
  status: IntelligenceQualityStatus,
): ReadonlyArray<IntelligenceLimitation> {
  const limitations: Array<IntelligenceLimitation> = quality.limitations.map(
    (code) => ({
      id: `limitation.youtube.${code}`,
      messageKey: `limitations.codes.${code}`,
      parameters: {},
      relatedSignalIds: [],
    }),
  );

  if (status === "limited") {
    limitations.unshift({
      id: "limitation.intelligence.insufficient-sample",
      messageKey: "limitations.codes.insufficient-sample",
      parameters: { sampleSize: quality.effectiveVideoCount },
      relatedSignalIds: quality.unevaluatedSignals.map((signal) => signal.code),
    });
  } else if (status === "partial") {
    limitations.unshift({
      id: "limitation.intelligence.partial-data",
      messageKey: "limitations.codes.partial-data",
      parameters: {
        missingFieldCount:
          quality.fields.partiallyAvailable.length + quality.fields.absent.length,
      },
      relatedSignalIds: quality.unevaluatedSignals.map((signal) => signal.code),
    });
  }

  return limitations;
}

export function interpretCreatorIntelligence(
  result: EngineExecutionResult<YouTubeIntelligenceOutput>,
): CreatorIntelligenceResult {
  try {
    if (result.status === "failed") {
      return failure(
        result,
        result.error.code === "YOUTUBE_INTELLIGENCE_VALIDATION_FAILED"
          ? "invalid-analytics-result"
          : "unexpected-error",
        result.error.code,
      );
    }

    if (!isCompatibleOutput(result.output)) {
      return failure(
        result,
        "incompatible-input",
        "CREATOR_INTELLIGENCE_INCOMPATIBLE_INPUT",
      );
    }

    const output = result.output;
    const resolvedQualityStatus = qualityStatus(output.dataQuality);
    const insights = output.signals.map((signal) =>
      insightFromSignal(signal, output.dataQuality),
    );
    const qualityInsight = dataQualityInsight(
      output.dataQuality,
      resolvedQualityStatus,
    );
    if (qualityInsight !== null) {
      insights.push(qualityInsight);
    }
    insights.sort(compareInsights);

    const context = createContext(output);
    const evidence = [
      ...contextEvidence(output.dataQuality),
      ...insights.flatMap((insight) => insight.evidence),
    ];

    return {
      status: "success",
      brief: createBrief(resolvedQualityStatus, insights, context),
      insights,
      evidence,
      context,
      quality: createQuality(output.dataQuality, resolvedQualityStatus),
      limitations: createLimitations(
        output.dataQuality,
        resolvedQualityStatus,
      ),
      metadata: {
        sourceEngineId: result.metadata.engineId,
        sourceExecutionId: result.metadata.executionId,
        generatedAt: output.context.analysisDate,
        interpreterVersion: CREATOR_INTELLIGENCE_INTERPRETER_VERSION,
      },
    };
  } catch {
    return failure(
      result,
      "unexpected-error",
      "CREATOR_INTELLIGENCE_INTERPRETATION_FAILED",
    );
  }
}
