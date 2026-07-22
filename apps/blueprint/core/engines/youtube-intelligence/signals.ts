import {
  calculatePublicationFrequency,
  calculateSignalConfidence,
  calculateVideoEngagement,
  calculateViewConcentration,
  median,
} from "./statistics";
import { YOUTUBE_INTELLIGENCE_THRESHOLDS } from "./thresholds";
import type {
  UnevaluatedSignal,
  YouTubeIntelligenceSignal,
  YouTubeSignalCode,
  YouTubeSignalImpact,
  YouTubeVideoInput,
  YouTubeVideoPerformance,
} from "./types";

export type SignalAnalysisResult = {
  signals: ReadonlyArray<YouTubeIntelligenceSignal>;
  unevaluatedSignals: ReadonlyArray<UnevaluatedSignal>;
};

type RelativeMetric = {
  videoId: string;
  value: number;
};

const TITLE_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "how", "in", "is", "of", "on", "or", "that", "the", "this", "to",
  "with", "you", "your",
  "de", "del", "el", "en", "la", "las", "los", "o", "para", "por",
  "que", "un", "una", "y", "tu",
  "au", "aux", "avec", "ce", "ces", "dans", "des", "du", "et", "la",
  "le", "les", "ou", "pour", "sur", "un", "une", "votre",
  "a", "as", "com", "como", "da", "das", "de", "do", "dos", "e",
  "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por",
  "seu", "sua", "um", "uma",
]);

function impactFromShare(share: number): YouTubeSignalImpact {
  if (share >= 0.5) {
    return "high";
  }
  if (share >= 0.25) {
    return "medium";
  }
  return "low";
}

function unavailable(
  code: YouTubeSignalCode,
  reason: UnevaluatedSignal["reason"],
  requiredVideos: number,
  availableVideos: number,
): UnevaluatedSignal {
  return { code, reason, requiredVideos, availableVideos };
}

function analyzePublicationInconsistency(
  videos: ReadonlyArray<YouTubeVideoInput>,
): YouTubeIntelligenceSignal | UnevaluatedSignal {
  const config =
    YOUTUBE_INTELLIGENCE_THRESHOLDS.signals.publicationInconsistency;
  if (videos.length < config.minimumVideos) {
    return unavailable(
      "publication-inconsistency",
      "insufficient-sample",
      config.minimumVideos,
      videos.length,
    );
  }

  const frequency = calculatePublicationFrequency(
    videos.map((video) => video.publishedAt),
  );
  const variation = frequency.coefficientOfVariation;
  if (variation === undefined) {
    return unavailable(
      "publication-inconsistency",
      "insufficient-variation",
      config.minimumVideos,
      videos.length,
    );
  }
  if (variation < config.minimumCoefficientOfVariation) {
    return unavailable(
      "publication-inconsistency",
      "no-qualifying-evidence",
      config.minimumVideos,
      videos.length,
    );
  }

  return {
    code: "publication-inconsistency",
    impact: variation >= 1 ? "high" : "medium",
    confidence: calculateSignalConfidence(
      videos.length,
      1,
      Math.min(1, variation / config.minimumCoefficientOfVariation),
    ),
    evidence: {
      coefficientOfVariation: variation,
      averageIntervalDays: frequency.averageIntervalDays ?? 0,
      medianIntervalDays: frequency.medianIntervalDays ?? 0,
      intervalCount: frequency.intervalCount,
    },
    relatedVideoIds: videos.map((video) => video.id),
    explanation: {
      code: "youtube.signal.publication-inconsistency",
      parameters: { coefficientOfVariation: variation },
    },
  };
}

function analyzeConcentration(
  videos: ReadonlyArray<YouTubeVideoInput>,
): YouTubeIntelligenceSignal | UnevaluatedSignal {
  const config = YOUTUBE_INTELLIGENCE_THRESHOLDS.signals.viewConcentration;
  if (videos.length < config.minimumVideos) {
    return unavailable(
      "view-concentration",
      "insufficient-sample",
      config.minimumVideos,
      videos.length,
    );
  }

  const concentration = calculateViewConcentration(
    videos.map((video) => video.views),
  );
  if (
    concentration.topVideoShare === undefined ||
    concentration.topThreeShare === undefined
  ) {
    return unavailable(
      "view-concentration",
      "insufficient-variation",
      config.minimumVideos,
      videos.length,
    );
  }
  if (
    concentration.topVideoShare < config.topVideoShare &&
    concentration.topThreeShare < config.topThreeShare
  ) {
    return unavailable(
      "view-concentration",
      "no-qualifying-evidence",
      config.minimumVideos,
      videos.length,
    );
  }

  const relatedVideos = [...videos]
    .sort((left, right) => right.views - left.views)
    .slice(0, 3);
  const consistency = Math.min(
    1,
    Math.max(
      concentration.topVideoShare / config.topVideoShare,
      concentration.topThreeShare / config.topThreeShare,
    ),
  );

  return {
    code: "view-concentration",
    impact:
      videos.length >= config.minimumVideosForHighImpact &&
      concentration.topVideoShare >= config.topVideoShare
        ? "high"
        : "medium",
    confidence: calculateSignalConfidence(videos.length, 1, consistency),
    evidence: {
      topVideoShare: concentration.topVideoShare,
      topThreeShare: concentration.topThreeShare,
      sampleSize: videos.length,
    },
    relatedVideoIds: relatedVideos.map((video) => video.id),
    explanation: {
      code: "youtube.signal.view-concentration",
      parameters: {
        topVideoShare: concentration.topVideoShare,
        topThreeShare: concentration.topThreeShare,
      },
    },
  };
}

function analyzeAboveMedianPerformance(
  performances: ReadonlyArray<YouTubeVideoPerformance>,
): YouTubeIntelligenceSignal | UnevaluatedSignal {
  const config =
    YOUTUBE_INTELLIGENCE_THRESHOLDS.signals.aboveMedianPerformance;
  if (performances.length < config.minimumVideos) {
    return unavailable(
      "above-median-performance",
      "insufficient-sample",
      config.minimumVideos,
      performances.length,
    );
  }

  const related = performances.filter(
    (performance) => performance.classification === "exceptional",
  );
  if (related.length === 0) {
    return unavailable(
      "above-median-performance",
      "no-qualifying-evidence",
      config.minimumVideos,
      performances.length,
    );
  }

  const ratios = related
    .map((performance) => performance.comparison.viewsToMedianRatio)
    .filter((ratio): ratio is number => ratio !== undefined);

  return {
    code: "above-median-performance",
    impact: impactFromShare(related.length / performances.length),
    confidence: calculateSignalConfidence(
      performances.length,
      1,
      related.length / performances.length,
    ),
    evidence: {
      exceptionalVideoCount: related.length,
      sampleSize: performances.length,
      maximumMedianRatio: ratios.length > 0 ? Math.max(...ratios) : 0,
    },
    relatedVideoIds: related.map((performance) => performance.videoId),
    explanation: {
      code: "youtube.signal.above-median-performance",
      parameters: { exceptionalVideoCount: related.length },
    },
  };
}

function analyzeRelativeMetric(
  metrics: ReadonlyArray<RelativeMetric>,
  totalVideoCount: number,
  highCode: YouTubeSignalCode,
  lowCode: YouTubeSignalCode,
): {
  signals: ReadonlyArray<YouTubeIntelligenceSignal>;
  unevaluated: ReadonlyArray<UnevaluatedSignal>;
} {
  const config = YOUTUBE_INTELLIGENCE_THRESHOLDS.signals.relativeMetric;
  if (metrics.length < config.minimumVideos) {
    const reason =
      metrics.length === 0 ? "metric-unavailable" : "insufficient-sample";
    return {
      signals: [],
      unevaluated: [
        unavailable(highCode, reason, config.minimumVideos, metrics.length),
        unavailable(lowCode, reason, config.minimumVideos, metrics.length),
      ],
    };
  }

  const metricMedian = median(metrics.map((metric) => metric.value));
  if (metricMedian === 0) {
    return {
      signals: [],
      unevaluated: [
        unavailable(
          highCode,
          "insufficient-variation",
          config.minimumVideos,
          metrics.length,
        ),
        unavailable(
          lowCode,
          "insufficient-variation",
          config.minimumVideos,
          metrics.length,
        ),
      ],
    };
  }

  const groups = [
    {
      code: highCode,
      matches: metrics.filter(
        (metric) => metric.value / metricMedian >= config.highRatio,
      ),
    },
    {
      code: lowCode,
      matches: metrics.filter(
        (metric) => metric.value / metricMedian < config.lowRatio,
      ),
    },
  ];
  const signals: Array<YouTubeIntelligenceSignal> = [];
  const unevaluated: Array<UnevaluatedSignal> = [];

  for (const group of groups) {
    if (group.matches.length === 0) {
      unevaluated.push(
        unavailable(
          group.code,
          "no-qualifying-evidence",
          config.minimumVideos,
          metrics.length,
        ),
      );
      continue;
    }

    const share = group.matches.length / metrics.length;
    signals.push({
      code: group.code,
      impact: impactFromShare(share),
      confidence: calculateSignalConfidence(
        metrics.length,
        totalVideoCount === 0 ? 0 : metrics.length / totalVideoCount,
        share,
      ),
      evidence: {
        channelMetricMedian: metricMedian,
        matchingVideoCount: group.matches.length,
        eligibleVideoCount: metrics.length,
      },
      relatedVideoIds: group.matches.map((metric) => metric.videoId),
      explanation: {
        code: `youtube.signal.${group.code}`,
        parameters: {
          channelMetricMedian: metricMedian,
          matchingVideoCount: group.matches.length,
        },
      },
    });
  }

  return { signals, unevaluated };
}

function analyzeFrequencyChange(
  videos: ReadonlyArray<YouTubeVideoInput>,
): YouTubeIntelligenceSignal | UnevaluatedSignal {
  const config =
    YOUTUBE_INTELLIGENCE_THRESHOLDS.signals.publicationFrequencyChange;
  if (videos.length < config.minimumVideos) {
    return unavailable(
      "publication-frequency-change",
      "insufficient-sample",
      config.minimumVideos,
      videos.length,
    );
  }

  const ordered = [...videos].sort(
    (left, right) => Date.parse(left.publishedAt) - Date.parse(right.publishedAt),
  );
  const intervals = calculatePublicationFrequency(
    ordered.map((video) => video.publishedAt),
  ).intervalsDays;
  const splitIndex = Math.floor(intervals.length / 2);
  const earlierMedian = median(intervals.slice(0, splitIndex));
  const recentMedian = median(intervals.slice(splitIndex));
  if (earlierMedian === 0) {
    return unavailable(
      "publication-frequency-change",
      "insufficient-variation",
      config.minimumVideos,
      videos.length,
    );
  }

  const relativeDifference =
    Math.abs(recentMedian - earlierMedian) / earlierMedian;
  if (relativeDifference < config.minimumRelativeDifference) {
    return unavailable(
      "publication-frequency-change",
      "no-qualifying-evidence",
      config.minimumVideos,
      videos.length,
    );
  }

  return {
    code: "publication-frequency-change",
    impact: relativeDifference >= 1 ? "high" : "medium",
    confidence: calculateSignalConfidence(
      videos.length,
      1,
      Math.min(1, relativeDifference),
    ),
    evidence: {
      earlierMedianIntervalDays: earlierMedian,
      recentMedianIntervalDays: recentMedian,
      relativeDifference,
      sampleSize: videos.length,
    },
    relatedVideoIds: ordered.map((video) => video.id),
    explanation: {
      code: "youtube.signal.publication-frequency-change",
      parameters: {
        direction:
          recentMedian < earlierMedian ? "more-frequent" : "less-frequent",
        relativeDifference,
      },
    },
  };
}

function analyzeDurationAssociation(
  videos: ReadonlyArray<YouTubeVideoInput>,
): YouTubeIntelligenceSignal | UnevaluatedSignal {
  const config =
    YOUTUBE_INTELLIGENCE_THRESHOLDS.signals.durationPerformanceAssociation;
  if (videos.length < config.minimumVideos) {
    return unavailable(
      "duration-performance-association",
      "insufficient-sample",
      config.minimumVideos,
      videos.length,
    );
  }

  const durationMedian = median(videos.map((video) => video.durationSeconds));
  const shorter = videos.filter(
    (video) => video.durationSeconds <= durationMedian,
  );
  const longer = videos.filter((video) => video.durationSeconds > durationMedian);
  if (
    shorter.length < config.minimumGroupSize ||
    longer.length < config.minimumGroupSize
  ) {
    return unavailable(
      "duration-performance-association",
      "insufficient-variation",
      config.minimumVideos,
      videos.length,
    );
  }

  const shorterMedianViews = median(shorter.map((video) => video.views));
  const longerMedianViews = median(longer.map((video) => video.views));
  const maximumMedianViews = Math.max(shorterMedianViews, longerMedianViews);
  const relativeDifference =
    maximumMedianViews === 0
      ? 0
      : Math.abs(longerMedianViews - shorterMedianViews) / maximumMedianViews;
  if (relativeDifference < config.minimumRelativeDifference) {
    return unavailable(
      "duration-performance-association",
      "no-qualifying-evidence",
      config.minimumVideos,
      videos.length,
    );
  }

  return {
    code: "duration-performance-association",
    impact: impactFromShare(relativeDifference),
    confidence: calculateSignalConfidence(
      videos.length,
      1,
      relativeDifference,
    ),
    evidence: {
      durationMedianSeconds: durationMedian,
      shorterGroupSize: shorter.length,
      longerGroupSize: longer.length,
      shorterMedianViews,
      longerMedianViews,
      relativeDifference,
      sampleSize: videos.length,
    },
    relatedVideoIds: videos.map((video) => video.id),
    explanation: {
      code: "youtube.signal.duration-performance-association",
      parameters: {
        higherObservedGroup:
          longerMedianViews > shorterMedianViews ? "longer" : "shorter",
        relativeDifference,
      },
    },
  };
}

function titleTerms(title: string): ReadonlySet<string> {
  const normalized = title
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ");

  return new Set(
    normalized
      .split(" ")
      .map((term) => term.trim())
      .filter((term) => term.length >= 2 && !TITLE_STOP_WORDS.has(term)),
  );
}

function analyzeRecurringTitleTerms(
  videos: ReadonlyArray<YouTubeVideoInput>,
): YouTubeIntelligenceSignal | UnevaluatedSignal {
  const config =
    YOUTUBE_INTELLIGENCE_THRESHOLDS.signals.recurringTitleTerms;
  if (videos.length < config.minimumVideos) {
    return unavailable(
      "recurring-title-terms",
      "insufficient-sample",
      config.minimumVideos,
      videos.length,
    );
  }

  const counts = new Map<string, number>();
  const termsByVideo = videos.map((video) => ({
    video,
    terms: titleTerms(video.title),
  }));
  for (const { terms } of termsByVideo) {
    for (const term of terms) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }

  const recurring = Array.from(counts.entries())
    .filter(
      ([, count]) =>
        count >= config.minimumTitleCount &&
        count / videos.length >= config.minimumVideoShare,
    )
    .sort(([left], [right]) => left.localeCompare(right));
  if (recurring.length === 0) {
    return unavailable(
      "recurring-title-terms",
      "no-qualifying-evidence",
      config.minimumVideos,
      videos.length,
    );
  }

  const recurringTerms = recurring.map(([term]) => term);
  const relatedVideoIds = termsByVideo
    .filter(({ terms }) => recurringTerms.some((term) => terms.has(term)))
    .map(({ video }) => video.id);
  const maximumVideoShare = Math.max(
    ...recurring.map(([, count]) => count / videos.length),
  );

  return {
    code: "recurring-title-terms",
    impact: impactFromShare(maximumVideoShare),
    confidence: calculateSignalConfidence(
      videos.length,
      1,
      maximumVideoShare,
    ),
    evidence: {
      qualifyingTermCount: recurring.length,
      maximumVideoShare,
      sampleSize: videos.length,
    },
    relatedVideoIds,
    relatedTerms: recurringTerms,
    explanation: {
      code: "youtube.signal.recurring-title-terms",
      parameters: {
        qualifyingTermCount: recurring.length,
        maximumVideoShare,
      },
    },
  };
}

function collectSingle(
  result: YouTubeIntelligenceSignal | UnevaluatedSignal,
  signals: Array<YouTubeIntelligenceSignal>,
  unevaluated: Array<UnevaluatedSignal>,
): void {
  if ("impact" in result) {
    signals.push(result);
  } else {
    unevaluated.push(result);
  }
}

export function analyzeYouTubeSignals(
  videos: ReadonlyArray<YouTubeVideoInput>,
  performances: ReadonlyArray<YouTubeVideoPerformance>,
): SignalAnalysisResult {
  const signals: Array<YouTubeIntelligenceSignal> = [];
  const unevaluatedSignals: Array<UnevaluatedSignal> = [];
  const engagementMetrics: Array<RelativeMetric> = [];

  for (const video of videos) {
    const engagement = calculateVideoEngagement(video);
    if (engagement) {
      engagementMetrics.push({
        videoId: video.id,
        value: engagement.rate,
      });
    }
  }

  collectSingle(
    analyzePublicationInconsistency(videos),
    signals,
    unevaluatedSignals,
  );
  collectSingle(analyzeConcentration(videos), signals, unevaluatedSignals);
  collectSingle(
    analyzeAboveMedianPerformance(performances),
    signals,
    unevaluatedSignals,
  );

  const relativeAnalyses = [
    analyzeRelativeMetric(
      videos
        .filter((video) => video.ctr !== undefined)
        .map((video) => ({ videoId: video.id, value: video.ctr ?? 0 })),
      videos.length,
      "relative-high-ctr",
      "relative-low-ctr",
    ),
    analyzeRelativeMetric(
      videos
        .filter((video) => video.averagePercentageViewed !== undefined)
        .map((video) => ({
          videoId: video.id,
          value: video.averagePercentageViewed ?? 0,
        })),
      videos.length,
      "relative-high-retention",
      "relative-low-retention",
    ),
    analyzeRelativeMetric(
      engagementMetrics,
      videos.length,
      "relative-high-engagement",
      "relative-low-engagement",
    ),
  ];

  for (const result of relativeAnalyses) {
    signals.push(...result.signals);
    unevaluatedSignals.push(...result.unevaluated);
  }

  collectSingle(analyzeFrequencyChange(videos), signals, unevaluatedSignals);
  collectSingle(
    analyzeDurationAssociation(videos),
    signals,
    unevaluatedSignals,
  );
  collectSingle(
    analyzeRecurringTitleTerms(videos),
    signals,
    unevaluatedSignals,
  );

  return { signals, unevaluatedSignals };
}
