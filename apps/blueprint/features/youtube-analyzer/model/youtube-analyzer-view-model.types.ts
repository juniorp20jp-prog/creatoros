import type {
  RelativePerformanceClassification,
  YouTubeDataQuality,
  YouTubeSignalCode,
  YouTubeSignalConfidence,
  YouTubeSignalImpact,
} from "../../../core";
import type { YouTubeAnalyzerScenarioId } from "../fixtures";

export type YouTubeAnalyzerSourceId = YouTubeAnalyzerScenarioId | "real";

export type YouTubeAnalyzerUiState =
  | "success"
  | "partial-data"
  | "insufficient-sample"
  | "validation-error"
  | "unexpected-error"
  | "empty"
  | "loading";

export type AnalyzerValueFormat =
  | "integer"
  | "decimal"
  | "percentage-ratio"
  | "percentage-points"
  | "seconds"
  | "days";

export type AnalyzerMetricId =
  | "analyzedVideos"
  | "totalViews"
  | "averageViews"
  | "medianViews"
  | "averagePublicationInterval"
  | "engagement"
  | "subscribersGained"
  | "viewConcentration";

export type AnalyzerMetricViewModel = {
  id: AnalyzerMetricId;
  value: number | null;
  format: AnalyzerValueFormat;
};

export type AnalyzerEvidenceViewModel = {
  key: string;
  value: number;
  format: AnalyzerValueFormat;
};

export type AnalyzerSignalViewModel = {
  code: YouTubeSignalCode;
  impact: YouTubeSignalImpact;
  confidence: YouTubeSignalConfidence;
  evidence: ReadonlyArray<AnalyzerEvidenceViewModel>;
  relatedVideoIds: ReadonlyArray<string>;
  relatedTerms: ReadonlyArray<string>;
  effectiveSampleSize: number;
};

export type AnalyzerVideoViewModel = {
  id: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  views: number;
  classification: RelativePerformanceClassification;
  engagementRate: number | null;
  ctr: number | null;
  averagePercentageViewed: number | null;
  subscribersGained: number | null;
  viewsToMedianRatio: number | null;
};

export type YouTubeAnalyzerSuccessViewModel = {
  state: "success" | "partial-data" | "insufficient-sample";
  scenarioId: YouTubeAnalyzerSourceId;
  channel: {
    id: string;
    name: string;
  };
  requestedPeriod: {
    startDate: string;
    endDate: string;
  };
  metrics: ReadonlyArray<AnalyzerMetricViewModel>;
  publishing: {
    includedVideoCount: number;
    averageIntervalDays: number | null;
    medianIntervalDays: number | null;
    coefficientOfVariation: number | null;
    inconsistencySignal: AnalyzerSignalViewModel | null;
    frequencyChangeSignal: AnalyzerSignalViewModel | null;
    inconsistencyUnevaluated: boolean;
    frequencyChangeUnevaluated: boolean;
  };
  videos: ReadonlyArray<AnalyzerVideoViewModel>;
  signals: ReadonlyArray<AnalyzerSignalViewModel>;
  quality: YouTubeDataQuality;
};

export type YouTubeAnalyzerErrorViewModel = {
  state: "validation-error" | "unexpected-error";
  scenarioId: YouTubeAnalyzerSourceId;
  errorCode: string;
};

export type YouTubeAnalyzerViewModel =
  | YouTubeAnalyzerSuccessViewModel
  | YouTubeAnalyzerErrorViewModel;
