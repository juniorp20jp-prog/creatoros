import type {
  EngineExecutionResult,
  YouTubeIntelligenceOutput,
  YouTubeIntelligenceSignal,
} from "../../../core";
import type {
  AnalyzerEvidenceViewModel,
  AnalyzerSignalViewModel,
  AnalyzerValueFormat,
  YouTubeAnalyzerSuccessViewModel,
  YouTubeAnalyzerViewModel,
  YouTubeAnalyzerSourceId,
} from "./youtube-analyzer-view-model.types";

function evidenceFormat(
  signal: YouTubeIntelligenceSignal,
  key: string,
): AnalyzerValueFormat {
  if (
    [
      "topVideoShare",
      "topThreeShare",
      "coefficientOfVariation",
      "relativeDifference",
      "maximumVideoShare",
    ].includes(key)
  ) {
    return "percentage-ratio";
  }

  if (key.includes("IntervalDays")) {
    return "days";
  }

  if (key.includes("Seconds")) {
    return "seconds";
  }

  if (key === "channelMetricMedian") {
    if (signal.code.includes("engagement")) {
      return "percentage-ratio";
    }
    if (signal.code.includes("ctr") || signal.code.includes("retention")) {
      return "percentage-points";
    }
  }

  if (
    key.includes("Count") ||
    key.includes("Size") ||
    key === "intervalCount"
  ) {
    return "integer";
  }

  return "decimal";
}

function createSignalViewModel(
  signal: YouTubeIntelligenceSignal,
  fallbackSampleSize: number,
): AnalyzerSignalViewModel {
  const evidence: ReadonlyArray<AnalyzerEvidenceViewModel> = Object.entries(
    signal.evidence,
  ).map(([key, value]) => ({
    key,
    value,
    format: evidenceFormat(signal, key),
  }));

  return {
    code: signal.code,
    impact: signal.impact,
    confidence: signal.confidence,
    evidence,
    relatedVideoIds: signal.relatedVideoIds,
    relatedTerms: signal.relatedTerms ?? [],
    effectiveSampleSize:
      signal.evidence.eligibleVideoCount ??
      signal.evidence.sampleSize ??
      fallbackSampleSize,
  };
}

function determineSuccessfulState(
  output: YouTubeIntelligenceOutput,
): YouTubeAnalyzerSuccessViewModel["state"] {
  if (output.dataQuality.effectiveVideoCount < 3) {
    return "insufficient-sample";
  }

  if (
    output.dataQuality.fields.partiallyAvailable.length > 0 ||
    output.dataQuality.fields.absent.length > 0 ||
    output.dataQuality.warnings.length > 0 ||
    output.dataQuality.unevaluatedSignals.some(
      (signal) =>
        signal.reason === "metric-unavailable" ||
        signal.reason === "insufficient-sample",
    )
  ) {
    return "partial-data";
  }

  return "success";
}

export function createYouTubeAnalyzerViewModel(
  scenarioId: YouTubeAnalyzerSourceId,
  result: EngineExecutionResult<YouTubeIntelligenceOutput>,
): YouTubeAnalyzerViewModel {
  if (result.status === "failed") {
    return {
      state:
        result.error.code === "YOUTUBE_INTELLIGENCE_VALIDATION_FAILED"
          ? "validation-error"
          : "unexpected-error",
      scenarioId,
      errorCode: result.error.code,
    };
  }

  const { output } = result;
  const signals = output.signals.map((signal) =>
    createSignalViewModel(signal, output.dataQuality.effectiveVideoCount),
  );
  const findSignal = (code: YouTubeIntelligenceSignal["code"]) =>
    signals.find((signal) => signal.code === code) ?? null;
  const isUnevaluated = (code: YouTubeIntelligenceSignal["code"]) =>
    output.dataQuality.unevaluatedSignals.some(
      (signal) => signal.code === code,
    );

  return {
    state: determineSuccessfulState(output),
    scenarioId,
    channel: {
      id: output.summary.channel.id,
      name: output.summary.channel.name,
    },
    requestedPeriod: output.summary.requestedPeriod,
    metrics: [
      {
        id: "analyzedVideos",
        value: output.summary.analyzedVideoCount,
        format: "integer",
      },
      {
        id: "totalViews",
        value: output.summary.totalViews,
        format: "integer",
      },
      {
        id: "averageViews",
        value: output.summary.averageViews,
        format: "decimal",
      },
      {
        id: "medianViews",
        value: output.summary.medianViews,
        format: "decimal",
      },
      {
        id: "averagePublicationInterval",
        value: output.summary.publicationFrequency.averageIntervalDays ?? null,
        format: "days",
      },
      {
        id: "engagement",
        value: output.summary.engagement.rate ?? null,
        format: "percentage-ratio",
      },
      {
        id: "subscribersGained",
        value: output.summary.subscriberImpact.totalSubscribersGained ?? null,
        format: "integer",
      },
      {
        id: "viewConcentration",
        value: output.summary.viewConcentration.topThreeShare ?? null,
        format: "percentage-ratio",
      },
    ],
    publishing: {
      includedVideoCount: output.summary.analyzedVideoCount,
      averageIntervalDays:
        output.summary.publicationFrequency.averageIntervalDays ?? null,
      medianIntervalDays:
        output.summary.publicationFrequency.medianIntervalDays ?? null,
      coefficientOfVariation:
        output.summary.publicationFrequency.coefficientOfVariation ?? null,
      inconsistencySignal: findSignal("publication-inconsistency"),
      frequencyChangeSignal: findSignal("publication-frequency-change"),
      inconsistencyUnevaluated: isUnevaluated("publication-inconsistency"),
      frequencyChangeUnevaluated: isUnevaluated(
        "publication-frequency-change",
      ),
    },
    videos: output.videos.map((video) => ({
      id: video.videoId,
      title: video.title,
      publishedAt: video.publishedAt,
      durationSeconds: video.metrics.durationSeconds,
      views: video.metrics.views,
      classification: video.classification,
      engagementRate: video.derivedMetrics.engagement?.rate ?? null,
      ctr: video.metrics.ctr ?? null,
      averagePercentageViewed:
        video.metrics.averagePercentageViewed ?? null,
      subscribersGained: video.metrics.subscribersGained ?? null,
      viewsToMedianRatio: video.comparison.viewsToMedianRatio ?? null,
    })),
    signals,
    quality: output.dataQuality,
  };
}

export function createRealYouTubeAnalyzerViewModel(
  output: YouTubeIntelligenceOutput,
): YouTubeAnalyzerSuccessViewModel {
  const viewModel = createYouTubeAnalyzerViewModel("real", {
    status: "completed",
    output,
    metadata: {
      executionId: "real-persisted-analysis",
      engineId: "youtube-intelligence",
      startedAt: output.context.analysisDate,
      finishedAt: output.context.analysisDate,
      providerIds: [],
      completedStepIds: [],
    },
  });
  if (!("metrics" in viewModel)) {
    throw new Error("A completed YouTube output must produce a success view model.");
  }
  return viewModel;
}
