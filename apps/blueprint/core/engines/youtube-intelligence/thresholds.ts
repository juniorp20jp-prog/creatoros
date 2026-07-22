export const YOUTUBE_INTELLIGENCE_THRESHOLDS = {
  classification: {
    belowMedianUpperRatio: 0.75,
    aboveMedianLowerRatio: 1.25,
    exceptionalLowerRatio: 2,
  },
  signals: {
    publicationInconsistency: {
      minimumVideos: 4,
      minimumCoefficientOfVariation: 0.5,
    },
    viewConcentration: {
      minimumVideos: 4,
      topVideoShare: 0.5,
      topThreeShare: 0.8,
      minimumVideosForHighImpact: 8,
    },
    aboveMedianPerformance: {
      minimumVideos: 3,
    },
    relativeMetric: {
      minimumVideos: 4,
      lowRatio: 0.75,
      highRatio: 1.25,
    },
    publicationFrequencyChange: {
      minimumVideos: 6,
      minimumRelativeDifference: 0.5,
    },
    durationPerformanceAssociation: {
      minimumVideos: 6,
      minimumGroupSize: 2,
      minimumRelativeDifference: 0.35,
    },
    recurringTitleTerms: {
      minimumVideos: 3,
      minimumTitleCount: 2,
      minimumVideoShare: 0.5,
    },
  },
  confidence: {
    high: {
      minimumSampleSize: 8,
      minimumAvailability: 0.8,
      minimumConsistency: 0.75,
    },
    medium: {
      minimumSampleSize: 4,
      minimumAvailability: 0.5,
      minimumConsistency: 0.5,
    },
  },
} as const;
