export const CREATOR_DECISION_THRESHOLDS = {
  confidence: {
    levels: {
      highMinimum: 0.75,
      mediumMinimum: 0.5,
    },
    weights: {
      dataAvailability: 0.25,
      sampleSize: 0.2,
      signalConsistency: 0.2,
      dataRecency: 0.15,
      deviationStrength: 0.2,
    },
    sampleSizeForFullScore: 8,
    recencyDays: {
      current: 30,
      recent: 90,
      usable: 180,
      historical: 365,
    },
  },
  prioritization: {
    levels: {
      highMinimum: 0.72,
      mediumMinimum: 0.48,
    },
    weights: {
      impact: 0.35,
      confidence: 0.3,
      urgency: 0.15,
      inverseEffort: 0.1,
      strategicRelevance: 0.1,
    },
  },
  rules: {
    minimumMetricSampleSize: 4,
    minimumPatternSampleSize: 3,
    assessments: {
      lowClickThrough: {
        urgency: 0.65,
        effort: 0.35,
        strategicRelevance: 0.75,
      },
      strongReachWeakRetention: {
        urgency: 0.75,
        effort: 0.55,
        strategicRelevance: 0.85,
      },
      publishingInconsistency: {
        urgency: 0.55,
        effort: 0.45,
        strategicRelevance: 0.65,
      },
      highPerformingPattern: {
        urgency: 0.45,
        effort: 0.6,
        strategicRelevance: 0.9,
      },
    },
  },
} as const;
