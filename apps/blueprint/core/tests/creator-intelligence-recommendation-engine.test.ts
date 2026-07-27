import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DefaultRecommendationEngine,
  type GrowthOpportunity,
} from "../engines/creator-intelligence";
import { createAnalysisResult } from "./fixtures/creator-intelligence-analysis-fixtures";

const opportunity: GrowthOpportunity = {
  id: "opportunity:channel_test:publishing-cadence",
  code: "stabilize-publishing-cadence",
  impact: "medium",
  evidence: [
    {
      metric: "publishing-interval-variation",
      value: 0.75,
    },
  ],
};

test("Recommendation Engine maps evidence-backed opportunities to typed actions", () => {
  const recommendations =
    new DefaultRecommendationEngine().recommend(
      createAnalysisResult({
        opportunities: [opportunity],
      }),
    );

  assert.deepEqual(recommendations, [
    {
      id: `recommendation:${opportunity.id}`,
      opportunityId: opportunity.id,
      actionCode: "define-repeatable-publishing-cadence",
      rationaleCode: "publishing-intervals-vary",
      priority: "medium",
      evidenceMetrics: ["publishing-interval-variation"],
    },
  ]);
});

test("Recommendation Engine emits nothing without opportunities", () => {
  assert.deepEqual(
    new DefaultRecommendationEngine().recommend(
      createAnalysisResult(),
    ),
    [],
  );
});

test("Recommendation Engine is deterministic and does not mutate its input", () => {
  const engine = new DefaultRecommendationEngine();
  const input = createAnalysisResult({
    opportunities: [opportunity],
  });
  const snapshot = structuredClone(input);

  assert.deepEqual(engine.recommend(input), engine.recommend(input));
  assert.deepEqual(input, snapshot);
});
