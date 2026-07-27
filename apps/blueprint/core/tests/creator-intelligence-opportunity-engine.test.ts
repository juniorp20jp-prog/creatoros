import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DefaultOpportunityEngine,
} from "../engines/creator-intelligence";
import { completeChannelMetrics } from "./fixtures/creator-intelligence-analysis-fixtures";

test("Opportunity Engine returns no generic opportunities for healthy metrics", () => {
  const opportunities = new DefaultOpportunityEngine().find(
    completeChannelMetrics,
  );

  assert.deepEqual(opportunities, []);
});

test("Opportunity Engine derives opportunities from measurable channel metrics", () => {
  const opportunities = new DefaultOpportunityEngine().find({
    ...completeChannelMetrics,
    dataCompleteness: 0.25,
    publishingIntervalVariation: 0.75,
    subscriberReachRate: 5,
  });

  assert.deepEqual(
    opportunities.map((opportunity) => opportunity.code),
    [
      "improve-data-coverage",
      "stabilize-publishing-cadence",
      "review-low-reach-content",
    ],
  );
  assert.equal(opportunities[0]?.impact, "high");
  assert.equal(
    opportunities.every(
      (opportunity) => opportunity.evidence.length > 0,
    ),
    true,
  );
});

test("Opportunity Engine does not infer unavailable conditions", () => {
  const opportunities = new DefaultOpportunityEngine().find({
    ...completeChannelMetrics,
    publishingIntervalVariation: undefined,
    subscriberReachRate: undefined,
  });

  assert.deepEqual(opportunities, []);
});
