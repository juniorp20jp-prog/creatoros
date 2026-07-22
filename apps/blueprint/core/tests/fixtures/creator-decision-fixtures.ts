import type {
  CreatorDecisionInput,
  CreatorSignal,
  DecisionEvidence,
} from "../../decisions/creator-decision-engine";

function evidence(
  signalId: string,
  key: string,
  value: number,
  unit = "ratio",
): DecisionEvidence {
  return {
    id: `evidence.${signalId}.${key}`,
    kind: key.includes("Count") ? "sample" : "comparison",
    label: {
      messageKey: `test.evidence.${key}`,
      defaultMessage: key,
      parameters: {},
    },
    value,
    unit,
    sourceRef: `fixture.${signalId}.${key}`,
    sourceSignalIds: [signalId],
  };
}

export const decisionSignals: ReadonlyArray<CreatorSignal> = [
  {
    id: "signal.fixture.low-ctr",
    dimension: "click-through-performance",
    direction: "negative",
    magnitude: 0.7,
    confidenceHint: 0.8,
    sampleSize: 8,
    observedAt: "2026-07-20T12:00:00Z",
    evidence: [
      evidence("signal.fixture.low-ctr", "channelMetricMedian", 7.5),
      evidence("signal.fixture.low-ctr", "matchingVideoCount", 3, "count"),
    ],
    relatedEntityIds: ["content-1", "content-2", "content-3"],
    tags: [],
  },
  {
    id: "signal.fixture.reach",
    dimension: "content-reach",
    direction: "positive",
    magnitude: 0.9,
    confidenceHint: 0.9,
    sampleSize: 8,
    observedAt: "2026-07-20T12:00:00Z",
    evidence: [
      evidence("signal.fixture.reach", "maximumMedianRatio", 2.8),
      evidence("signal.fixture.reach", "sampleSize", 8, "count"),
    ],
    relatedEntityIds: ["content-1", "content-4"],
    tags: [],
  },
  {
    id: "signal.fixture.retention",
    dimension: "retention",
    direction: "negative",
    magnitude: 0.75,
    confidenceHint: 0.8,
    sampleSize: 8,
    observedAt: "2026-07-20T12:00:00Z",
    evidence: [
      evidence("signal.fixture.retention", "channelMetricMedian", 48),
      evidence("signal.fixture.retention", "matchingVideoCount", 2, "count"),
    ],
    relatedEntityIds: ["content-1", "content-5"],
    tags: [],
  },
  {
    id: "signal.fixture.publishing",
    dimension: "publishing-consistency",
    direction: "negative",
    magnitude: 0.8,
    confidenceHint: 0.9,
    sampleSize: 8,
    observedAt: "2026-07-20T12:00:00Z",
    evidence: [
      evidence("signal.fixture.publishing", "coefficientOfVariation", 0.8),
      evidence("signal.fixture.publishing", "medianIntervalDays", 7, "days"),
    ],
    relatedEntityIds: ["content-1", "content-2", "content-3", "content-4"],
    tags: [],
  },
  {
    id: "signal.fixture.pattern",
    dimension: "content-pattern",
    direction: "positive",
    magnitude: 0.75,
    confidenceHint: 0.8,
    sampleSize: 8,
    observedAt: "2026-07-20T12:00:00Z",
    evidence: [
      evidence("signal.fixture.pattern", "maximumVideoShare", 0.75),
      evidence("signal.fixture.pattern", "qualifyingTermCount", 2, "count"),
    ],
    relatedEntityIds: ["content-1", "content-3", "content-4"],
    tags: ["creator", "workflow"],
  },
];

export function createDecisionInput(
  overrides: Partial<CreatorDecisionInput> = {},
): CreatorDecisionInput {
  return {
    creatorId: "creator-fixture",
    signals: decisionSignals,
    insights: [
      {
        id: "insight.fixture.packaging",
        category: "risk",
        statement: {
          messageKey: "test.insight.packaging",
          defaultMessage: "Packaging performance is below the creator baseline.",
          parameters: {},
        },
        sourceSignalIds: ["signal.fixture.low-ctr"],
        evidence: decisionSignals[0]?.evidence ?? [],
        confidenceHint: 0.8,
        limitations: [],
        relatedEntityIds: ["content-1"],
      },
    ],
    context: {
      analysisDate: "2026-07-20T12:00:00Z",
      period: {
        startDate: "2026-06-20T00:00:00Z",
        endDate: "2026-07-20T00:00:00Z",
      },
      sampleSize: 8,
      dataAvailability: 1,
      creatorObjective: "audience-growth",
    },
    sourceMetadata: {
      sourceKind: "test-analytics",
      sourceId: "fixture-source",
      attributes: {},
    },
    ...overrides,
  };
}

