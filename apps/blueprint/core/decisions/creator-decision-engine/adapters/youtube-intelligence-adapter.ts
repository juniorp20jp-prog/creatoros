import type {
  YouTubeIntelligenceOutput,
  YouTubeIntelligenceSignal,
  YouTubeSignalCode,
  YouTubeSignalConfidence,
} from "../../../engines/youtube-intelligence";
import type {
  CreatorIntelligenceResult,
  CreatorIntelligenceSuccess,
  EvidenceBlock,
} from "../../../intelligence/creator-intelligence";
import type { EngineExecutionResult } from "../../../types";
import type { SignalExtractor } from "../contracts";
import type {
  CreatorDecisionInput,
  CreatorInsight,
  CreatorSignal,
  CreatorSignalDimension,
  DecisionEvidence,
  DecisionEvidenceKind,
} from "../domain";

type YouTubeAdapterSource = {
  analytics: YouTubeIntelligenceOutput;
  intelligence: CreatorIntelligenceSuccess;
  executionId: string;
};

export type YouTubeDecisionAdapterResult =
  | { status: "completed"; input: CreatorDecisionInput }
  | {
      status: "failed";
      reason: "analytics-failed" | "intelligence-failed";
      errorCode: string;
    };

const DIMENSIONS = {
  "publication-inconsistency": "publishing-consistency",
  "view-concentration": "content-concentration",
  "above-median-performance": "content-reach",
  "relative-high-ctr": "click-through-performance",
  "relative-low-ctr": "click-through-performance",
  "relative-high-retention": "retention",
  "relative-low-retention": "retention",
  "relative-high-engagement": "engagement",
  "relative-low-engagement": "engagement",
  "publication-frequency-change": "recent-momentum",
  "duration-performance-association": "content-pattern",
  "recurring-title-terms": "content-pattern",
} as const satisfies Record<YouTubeSignalCode, CreatorSignalDimension>;

const DEFAULT_SIGNAL_MESSAGES = {
  "publication-inconsistency": "Publishing intervals are inconsistent.",
  "view-concentration": "A small set of content concentrates channel reach.",
  "above-median-performance": "Some content performs exceptionally relative to the creator median.",
  "relative-high-ctr": "Click-through performance is high relative to the creator median.",
  "relative-low-ctr": "Click-through performance is low relative to the creator median.",
  "relative-high-retention": "Retention is high relative to the creator median.",
  "relative-low-retention": "Retention is low relative to the creator median.",
  "relative-high-engagement": "Engagement is high relative to the creator median.",
  "relative-low-engagement": "Engagement is low relative to the creator median.",
  "publication-frequency-change": "Publishing frequency changed relative to the earlier period.",
  "duration-performance-association": "Content duration is associated with a performance difference in this sample.",
  "recurring-title-terms": "Recurring title terms form a deterministic content pattern.",
} as const satisfies Record<YouTubeSignalCode, string>;

function confidenceHint(confidence: YouTubeSignalConfidence): number {
  if (confidence === "high") {
    return 1;
  }
  if (confidence === "medium") {
    return 0.65;
  }
  return 0.35;
}

function signalDirection(
  signal: YouTubeIntelligenceSignal,
): CreatorSignal["direction"] {
  if (signal.code.includes("relative-high")) {
    return "positive";
  }
  if (
    signal.code.includes("relative-low") ||
    signal.code === "publication-inconsistency" ||
    signal.code === "view-concentration"
  ) {
    return "negative";
  }
  if (signal.code === "publication-frequency-change") {
    return signal.explanation.parameters.direction === "more-frequent"
      ? "positive"
      : "negative";
  }
  if (
    signal.code === "above-median-performance" ||
    signal.code === "recurring-title-terms"
  ) {
    return "positive";
  }
  return "neutral";
}

function evidenceKind(key: string): DecisionEvidenceKind {
  if (key.includes("Count") || key.includes("Size")) {
    return "sample";
  }
  if (
    key.includes("Ratio") ||
    key.includes("Difference") ||
    key.includes("Median") ||
    key.includes("Share")
  ) {
    return "comparison";
  }
  return "metric";
}

function evidenceUnit(signal: YouTubeIntelligenceSignal, key: string): string {
  if (
    key.includes("Share") ||
    key.includes("Ratio") ||
    key === "coefficientOfVariation" ||
    key === "relativeDifference"
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
    return signal.code.includes("engagement")
      ? "ratio"
      : "percentage-points";
  }
  return key.includes("Count") || key.includes("Size") ? "count" : "decimal";
}

function signalEvidence(
  signal: YouTubeIntelligenceSignal,
): ReadonlyArray<DecisionEvidence> {
  const signalId = `signal.youtube.${signal.code}`;
  return Object.entries(signal.evidence)
    .map(([key, value]) => ({
      id: `decision-evidence.youtube.${signal.code}.${key}`,
      kind: evidenceKind(key),
      label: {
        messageKey: `creatorDecisions.evidence.${key}`,
        defaultMessage: key,
        parameters: {},
      },
      value,
      unit: evidenceUnit(signal, key),
      sourceRef: `youtube.signals.${signal.code}.evidence.${key}`,
      sourceSignalIds: [signalId],
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function sampleSize(signal: YouTubeIntelligenceSignal): number | null {
  return (
    signal.evidence.eligibleVideoCount ??
    signal.evidence.sampleSize ??
    signal.evidence.intervalCount ??
    null
  );
}

function magnitude(signal: YouTubeIntelligenceSignal): number {
  const evidence = signal.evidence;
  const raw =
    evidence.maximumVideoShare ??
    evidence.topVideoShare ??
    evidence.relativeDifference ??
    evidence.coefficientOfVariation ??
    (evidence.maximumMedianRatio === undefined
      ? undefined
      : evidence.maximumMedianRatio / 2) ??
    (evidence.matchingVideoCount !== undefined &&
    evidence.eligibleVideoCount !== undefined &&
    evidence.eligibleVideoCount > 0
      ? evidence.matchingVideoCount / evidence.eligibleVideoCount
      : undefined) ??
    (signal.impact === "high" ? 0.9 : signal.impact === "medium" ? 0.65 : 0.35);
  return Math.round(Math.min(1, Math.max(0, raw)) * 1000) / 1000;
}

function mapSignal(
  signal: YouTubeIntelligenceSignal,
  observedAt: string,
): CreatorSignal {
  return {
    id: `signal.youtube.${signal.code}`,
    dimension: DIMENSIONS[signal.code],
    direction: signalDirection(signal),
    magnitude: magnitude(signal),
    confidenceHint: confidenceHint(signal.confidence),
    sampleSize: sampleSize(signal),
    observedAt,
    evidence: signalEvidence(signal),
    relatedEntityIds: [...signal.relatedVideoIds].sort(),
    tags: [...(signal.relatedTerms ?? [])].sort(),
  };
}

function mapInsightEvidence(
  evidence: ReadonlyArray<EvidenceBlock>,
  sourceSignalIds: ReadonlyArray<string>,
): ReadonlyArray<DecisionEvidence> {
  return evidence.map((block) => ({
    id: `decision-${block.id}`,
    kind: block.kind === "availability" ? "quality" : evidenceKind(block.id),
    label: {
      messageKey: block.labelKey,
      defaultMessage: block.labelKey,
      parameters: {},
    },
    value: block.value,
    unit: block.unit,
    sourceRef: block.sourceRef,
    sourceSignalIds,
  }));
}

function mapInsights(source: YouTubeAdapterSource): ReadonlyArray<CreatorInsight> {
  return source.intelligence.insights.map((insight) => {
    const sourceSignalIds = insight.sourceSignalIds.map(
      (code) => `signal.youtube.${code}`,
    );
    const firstCode = insight.sourceSignalIds[0];
    return {
      id: `decision-${insight.id}`,
      category: insight.category,
      statement: {
        messageKey: insight.descriptionKey,
        defaultMessage:
          firstCode === undefined
            ? "Data quality limits the available interpretation."
            : DEFAULT_SIGNAL_MESSAGES[firstCode],
        parameters: insight.parameters,
      },
      sourceSignalIds,
      evidence: mapInsightEvidence(insight.evidence, sourceSignalIds),
      confidenceHint:
        insight.confidence === null ? 0 : confidenceHint(insight.confidence),
      limitations: insight.limitations,
      relatedEntityIds: [...insight.relatedVideoIds].sort(),
    };
  });
}

function availabilityScore(output: YouTubeIntelligenceOutput): number {
  const fields = output.dataQuality.fields;
  const total =
    fields.completelyAvailable.length +
    fields.partiallyAvailable.length +
    fields.absent.length;
  if (total === 0) {
    return 0;
  }
  return Math.round(
    ((fields.completelyAvailable.length + fields.partiallyAvailable.length * 0.5) /
      total) *
      1000,
  ) / 1000;
}

export class YouTubeIntelligenceSignalExtractor
  implements SignalExtractor<YouTubeAdapterSource>
{
  extract(source: YouTubeAdapterSource): ReadonlyArray<CreatorSignal> {
    return source.analytics.signals
      .map((signal) => mapSignal(signal, source.analytics.context.analysisDate))
      .sort((left, right) => left.id.localeCompare(right.id));
  }
}

const youtubeSignalExtractor = new YouTubeIntelligenceSignalExtractor();

export function adaptYouTubeIntelligenceToDecisionInput(
  analyticsResult: EngineExecutionResult<YouTubeIntelligenceOutput>,
  intelligenceResult: CreatorIntelligenceResult,
): YouTubeDecisionAdapterResult {
  if (analyticsResult.status === "failed") {
    return {
      status: "failed",
      reason: "analytics-failed",
      errorCode: analyticsResult.error.code,
    };
  }
  if (intelligenceResult.status === "failure") {
    return {
      status: "failed",
      reason: "intelligence-failed",
      errorCode: intelligenceResult.errorCode,
    };
  }

  const source: YouTubeAdapterSource = {
    analytics: analyticsResult.output,
    intelligence: intelligenceResult,
    executionId: analyticsResult.metadata.executionId,
  };
  const objective = analyticsResult.output.context.creatorObjective;
  return {
    status: "completed",
    input: {
      creatorId: analyticsResult.output.summary.channel.id,
      signals: youtubeSignalExtractor.extract(source),
      insights: mapInsights(source),
      context: {
        analysisDate: analyticsResult.output.context.analysisDate,
        period: analyticsResult.output.summary.requestedPeriod,
        sampleSize: analyticsResult.output.dataQuality.effectiveVideoCount,
        dataAvailability: availabilityScore(analyticsResult.output),
        creatorObjective: objective?.kind ?? null,
      },
      sourceMetadata: {
        sourceKind: "channel-analytics",
        sourceId: analyticsResult.output.summary.channel.id,
        executionId: analyticsResult.metadata.executionId,
        platform: "youtube",
        attributes: {
          engineId: analyticsResult.metadata.engineId,
          market: analyticsResult.output.context.market ?? "unspecified",
        },
      },
    },
  };
}
