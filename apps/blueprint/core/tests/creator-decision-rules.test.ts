import assert from "node:assert/strict";
import test from "node:test";

import {
  highPerformingPatternRule,
  lowClickThroughRule,
  publishingInconsistencyRule,
  strongReachWeakRetentionRule,
} from "../decisions/creator-decision-engine";
import {
  createDecisionInput,
  decisionSignals,
} from "./fixtures/creator-decision-fixtures";

test("low click-through rule creates measurable packaging evidence", () => {
  const candidate = lowClickThroughRule.evaluate(createDecisionInput());
  assert.ok(candidate);
  assert.equal(candidate.category, "content-packaging");
  assert.equal(candidate.metrics[0]?.id, "metric.click-through-performance");
  assert.equal(candidate.metrics[0]?.baseline, 7.5);
});

test("low click-through rule does not fire with insufficient evidence", () => {
  const lowCtr = decisionSignals[0];
  assert.ok(lowCtr);
  const candidate = lowClickThroughRule.evaluate(
    createDecisionInput({ signals: [{ ...lowCtr, sampleSize: 3 }] }),
  );
  assert.equal(candidate, null);
});

test("strong reach and weak retention rule requires overlap", () => {
  const candidate = strongReachWeakRetentionRule.evaluate(createDecisionInput());
  assert.ok(candidate);
  assert.equal(candidate.category, "audience-retention");
  assert.deepEqual([...candidate.supportingSignalIds].sort(), [
    "signal.fixture.reach",
    "signal.fixture.retention",
  ]);
});

test("strong reach and weak retention rule does not infer a relationship without overlap", () => {
  const signals = decisionSignals.map((signal) =>
    signal.id === "signal.fixture.retention"
      ? { ...signal, relatedEntityIds: ["unrelated-content"] }
      : signal,
  );
  assert.equal(
    strongReachWeakRetentionRule.evaluate(createDecisionInput({ signals })),
    null,
  );
});

test("publishing inconsistency rule uses observed cadence metrics", () => {
  const candidate = publishingInconsistencyRule.evaluate(createDecisionInput());
  assert.ok(candidate);
  assert.equal(candidate.metrics[0]?.baseline, 0.8);
  assert.equal(candidate.metrics[0]?.target.direction, "decrease");
  assert.equal(candidate.recommendedAction.parameters.medianIntervalDays, 7);
});

test("publishing inconsistency rule does not fire for a positive signal", () => {
  const signals = decisionSignals.map((signal) =>
    signal.id === "signal.fixture.publishing"
      ? { ...signal, direction: "positive" as const }
      : signal,
  );
  assert.equal(
    publishingInconsistencyRule.evaluate(createDecisionInput({ signals })),
    null,
  );
});

test("high-performing pattern rule proposes one validation before a series", () => {
  const candidate = highPerformingPatternRule.evaluate(createDecisionInput());
  assert.ok(candidate);
  assert.equal(candidate.category, "content-strategy");
  assert.equal(candidate.alternatives[0]?.id, "alternative.high-performing-pattern.series");
  assert.equal(candidate.metrics[0]?.baseline, 2.8);
});

test("high-performing pattern rule does not invent a topic without deterministic tags", () => {
  const signals = decisionSignals.map((signal) =>
    signal.id === "signal.fixture.pattern" ? { ...signal, tags: [] } : signal,
  );
  assert.equal(
    highPerformingPatternRule.evaluate(createDecisionInput({ signals })),
    null,
  );
});
