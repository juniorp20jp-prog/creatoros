import type {
  DataQualityWarning,
  ExcludedVideo,
  UnevaluatedSignal,
  YouTubeDataQuality,
  YouTubeSignalCode,
  YouTubeSignalConfidence,
} from "../../engines/youtube-intelligence";

export const CREATOR_INTELLIGENCE_INTERPRETER_VERSION = "1.0.0" as const;

export type IntelligenceStatus =
  | "healthy"
  | "attention"
  | "limited"
  | "unknown";

export type IntelligenceQualityStatus =
  | "complete"
  | "partial"
  | "limited";

export type CreatorInsightCategory =
  | "opportunity"
  | "risk"
  | "pattern"
  | "finding"
  | "data-quality";

export type CreatorInsightPriority = "high" | "medium" | "low";

export type IntelligenceMessageParameters = Readonly<
  Record<string, string | number>
>;

export type BriefStatement = {
  id: string;
  messageKey: string;
  parameters: IntelligenceMessageParameters;
  evidenceRefs: ReadonlyArray<string>;
  confidence: YouTubeSignalConfidence | null;
};

export type ExecutiveBrief = {
  headline: BriefStatement;
  summary: ReadonlyArray<BriefStatement>;
  status: IntelligenceStatus;
  confidence: YouTubeSignalConfidence | null;
};

export type EvidenceKind =
  | "metric"
  | "comparison"
  | "concentration"
  | "sample"
  | "availability";

export type EvidenceUnit =
  | "count"
  | "decimal"
  | "ratio"
  | "percentage-points"
  | "seconds"
  | "days";

export type EvidenceBlock = {
  id: string;
  kind: EvidenceKind;
  labelKey: string;
  value: number;
  unit: EvidenceUnit;
  sourceRef: string;
};

export type CreatorInsight = {
  id: string;
  category: CreatorInsightCategory;
  priority: CreatorInsightPriority;
  titleKey: string;
  descriptionKey: string;
  parameters: IntelligenceMessageParameters;
  confidence: YouTubeSignalConfidence | null;
  evidence: ReadonlyArray<EvidenceBlock>;
  sampleSize: number | null;
  limitations: ReadonlyArray<string>;
  sourceSignalIds: ReadonlyArray<YouTubeSignalCode>;
  relatedVideoIds: ReadonlyArray<string>;
  relatedTerms: ReadonlyArray<string>;
};

export type IntelligenceAnalysisContext = {
  channel: { id: string; name: string };
  requestedPeriod: { startDate: string; endDate: string };
  coveredPeriod: { startDate: string; endDate: string } | null;
  inputVideoCount: number;
  includedVideoCount: number;
  excludedVideoCount: number;
  effectiveSampleSize: number;
  generatedAt: string;
  availableMetrics: ReadonlyArray<string>;
};

export type IntelligenceQuality = {
  status: IntelligenceQualityStatus;
  fields: YouTubeDataQuality["fields"];
  sampleSize: number;
  warnings: ReadonlyArray<DataQualityWarning>;
  exclusions: ReadonlyArray<ExcludedVideo>;
  unevaluatedSignals: ReadonlyArray<UnevaluatedSignal>;
  insufficientMetricCount: number;
};

export type IntelligenceLimitation = {
  id: string;
  messageKey: string;
  parameters: IntelligenceMessageParameters;
  relatedSignalIds: ReadonlyArray<YouTubeSignalCode>;
};

export type IntelligenceMetadata = {
  sourceEngineId: string;
  sourceExecutionId: string;
  generatedAt: string;
  interpreterVersion: typeof CREATOR_INTELLIGENCE_INTERPRETER_VERSION;
};

export type CreatorIntelligenceSuccess = {
  status: "success";
  brief: ExecutiveBrief;
  insights: ReadonlyArray<CreatorInsight>;
  evidence: ReadonlyArray<EvidenceBlock>;
  context: IntelligenceAnalysisContext;
  quality: IntelligenceQuality;
  limitations: ReadonlyArray<IntelligenceLimitation>;
  metadata: IntelligenceMetadata;
};

export type CreatorIntelligenceFailureReason =
  | "invalid-analytics-result"
  | "incompatible-input"
  | "unexpected-error"
  | "insufficient-information";

export type CreatorIntelligenceFailure = {
  status: "failure";
  reason: CreatorIntelligenceFailureReason;
  errorCode: string;
  messageKey: string;
  metadata: {
    sourceEngineId: string;
    sourceExecutionId: string;
    generatedAt: string | null;
    interpreterVersion: typeof CREATOR_INTELLIGENCE_INTERPRETER_VERSION;
  };
};

export type CreatorIntelligenceResult =
  | CreatorIntelligenceSuccess
  | CreatorIntelligenceFailure;
