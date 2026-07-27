import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DefaultScoreEngine,
  type ChannelMetrics,
} from "../engines/creator-intelligence";
import { completeChannelMetrics } from "./fixtures/creator-intelligence-analysis-fixtures";

test("Score Engine calculates the four documented scores", () => {
  const scores = new DefaultScoreEngine().calculate(
    completeChannelMetrics,
  );

  assert.deepEqual(
    scores.map((score) => [score.kind, score.value]),
    [
      ["content", 100],
      ["consistency", 100],
      ["optimization", 100],
      ["growth", 100],
    ],
  );
  assert.equal(
    scores.every((score) => score.availability === "calculated"),
    true,
  );
});

test("Score Engine marks unavailable calculations without inventing evidence", () => {
  const sparseMetrics: ChannelMetrics = {
    ...completeChannelMetrics,
    averageEngagementRate: undefined,
    publishingIntervalVariation: undefined,
    subscriberReachRate: undefined,
    dataCompleteness: 0,
  };
  const scores = new DefaultScoreEngine().calculate(sparseMetrics);

  for (const kind of ["content", "consistency", "growth"] as const) {
    const score = scores.find((item) => item.kind === kind);
    assert.equal(score?.availability, "insufficient-data");
    assert.equal(score?.value, 0);
    assert.deepEqual(score?.evidence, []);
  }

  assert.deepEqual(
    scores.find((score) => score.kind === "optimization"),
    {
      kind: "optimization",
      value: 0,
      availability: "calculated",
      evidence: [
        {
          metric: "data-completeness",
          value: 0,
        },
      ],
    },
  );
});

test("Score Engine clamps values to the 0-100 contract", () => {
  const scores = new DefaultScoreEngine().calculate({
    ...completeChannelMetrics,
    averageEngagementRate: 50,
    publishingIntervalVariation: 2,
    subscriberReachRate: 500,
    dataCompleteness: 1.5,
  });

  assert.equal(
    scores.every(
      (score) => score.value >= 0 && score.value <= 100,
    ),
    true,
  );
  assert.equal(
    scores.find((score) => score.kind === "consistency")?.value,
    0,
  );
});
