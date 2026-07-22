import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDecisionConfidence,
  generateCreatorDecisions,
  lowClickThroughRule,
  StableDecisionPrioritizer,
} from "../decisions/creator-decision-engine";
import { createPrioritizedDecision } from "../decisions/creator-decision-engine/prioritization";
import { createDecisionInput } from "./fixtures/creator-decision-fixtures";

test("the engine executes every registered rule and returns prioritized decisions", () => {
  const result = generateCreatorDecisions(createDecisionInput());
  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }

  assert.equal(result.metadata.evaluatedRuleIds.length, 4);
  assert.deepEqual(
    new Set(result.decisions.map((decision) => decision.ruleId)),
    new Set(result.metadata.evaluatedRuleIds),
  );
  assert.ok(
    result.decisions.every(
      (decision, index) =>
        index === 0 ||
        (result.decisions[index - 1]?.prioritization.score ?? 0) >=
          decision.prioritization.score,
    ),
  );
});

test("decision generation is deterministic", () => {
  const input = createDecisionInput();
  assert.deepEqual(generateCreatorDecisions(input), generateCreatorDecisions(input));
});

test("the first version does not fabricate an unsupported growth slowdown", () => {
  const result = generateCreatorDecisions(createDecisionInput());
  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }
  assert.ok(result.decisions.every((decision) => decision.category !== "growth"));
  assert.ok(
    result.decisions.every(
      (decision) => !decision.ruleId.includes("growth-slowdown"),
    ),
  );
});

test("confidence uses all five documented factors and remains in range", () => {
  const input = createDecisionInput();
  const candidate = lowClickThroughRule.evaluate(input);
  assert.ok(candidate);
  const confidence = calculateDecisionConfidence(candidate, input);

  assert.equal(confidence.factors.length, 5);
  assert.deepEqual(
    confidence.factors.map((factor) => factor.id),
    [
      "data-availability",
      "sample-size",
      "signal-consistency",
      "data-recency",
      "deviation-strength",
    ],
  );
  assert.equal(confidence.score, 0.9);
  assert.equal(confidence.level, "high");
  assert.match(confidence.explanation.defaultMessage, /does not imply certainty/);
});

test("missing availability and a small sample lower confidence", () => {
  const strongInput = createDecisionInput();
  const weakInput = createDecisionInput({
    context: {
      ...strongInput.context,
      sampleSize: 2,
      dataAvailability: 0.25,
      period: null,
    },
  });
  const strongCandidate = lowClickThroughRule.evaluate(strongInput);
  const weakCandidate = lowClickThroughRule.evaluate(weakInput);
  assert.ok(strongCandidate);
  assert.ok(weakCandidate);

  const strong = calculateDecisionConfidence(strongCandidate, strongInput);
  const weak = calculateDecisionConfidence(weakCandidate, weakInput);
  assert.ok(weak.score < strong.score);
  assert.notEqual(weak.level, "high");
});

test("priority calculation accounts for confidence and transparent assessment", () => {
  const input = createDecisionInput();
  const candidate = lowClickThroughRule.evaluate(input);
  assert.ok(candidate);
  const confidence = calculateDecisionConfidence(candidate, input);
  const decision = createPrioritizedDecision(candidate, confidence);

  assert.equal(decision.priority, "high");
  assert.equal(decision.prioritization.score, 0.753);
  assert.equal(decision.prioritization.effort, 0.35);
});

test("prioritization preserves stable ordering when scores tie", () => {
  const result = generateCreatorDecisions(createDecisionInput());
  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }
  const source = result.decisions[0];
  assert.ok(source);
  const alpha = { ...source, id: "decision-alpha", ruleId: "rule-alpha" };
  const beta = { ...source, id: "decision-beta", ruleId: "rule-beta" };
  const prioritizer = new StableDecisionPrioritizer();
  const keys = new Map([
    [alpha.id, alpha.id],
    [beta.id, beta.id],
  ]);

  assert.deepEqual(
    prioritizer.prioritize([beta, alpha], keys).map((decision) => decision.id),
    ["decision-alpha", "decision-beta"],
  );
});

test("prioritization suppresses overlapping decisions and keeps the stronger one", () => {
  const result = generateCreatorDecisions(createDecisionInput());
  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }
  const source = result.decisions[0];
  assert.ok(source);
  const weaker = {
    ...source,
    id: "decision-weaker",
    prioritization: { ...source.prioritization, score: 0.2 },
  };
  const stronger = {
    ...source,
    id: "decision-stronger",
    prioritization: { ...source.prioritization, score: 0.9 },
  };
  const key = "same-problem";
  const prioritizer = new StableDecisionPrioritizer();
  const selected = prioritizer.prioritize(
    [weaker, stronger],
    new Map([
      [weaker.id, key],
      [stronger.id, key],
    ]),
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.id, "decision-stronger");
});
