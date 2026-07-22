import assert from "node:assert/strict";
import test from "node:test";

import {
  generateCreatorDecisions,
  validateCreatorDecision,
  validateCreatorDecisionInput,
} from "../decisions/creator-decision-engine";
import { createDecisionInput } from "./fixtures/creator-decision-fixtures";

test("a valid normalized decision input passes runtime validation", () => {
  assert.deepEqual(validateCreatorDecisionInput(createDecisionInput()), []);
});

test("input validation rejects duplicate signals and out-of-range values", () => {
  const base = createDecisionInput();
  const duplicate = base.signals[0];
  assert.ok(duplicate);
  const issues = validateCreatorDecisionInput({
    ...base,
    signals: [duplicate, { ...duplicate, magnitude: 1.2 }],
    context: { ...base.context, dataAvailability: -0.1 },
  });

  assert.ok(issues.some((issue) => issue.code === "duplicate"));
  assert.ok(
    issues.filter((issue) => issue.code === "outside-unit-interval").length >= 2,
  );
});

test("input validation rejects invalid dates and sample sizes", () => {
  const base = createDecisionInput();
  const issues = validateCreatorDecisionInput({
    ...base,
    context: { ...base.context, analysisDate: "not-a-date", sampleSize: -1 },
  });

  assert.ok(issues.some((issue) => issue.field === "context.analysisDate"));
  assert.ok(issues.some((issue) => issue.field === "context.sampleSize"));
});

test("generated decisions satisfy the decision domain contract", () => {
  const result = generateCreatorDecisions(createDecisionInput());
  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }
  assert.ok(result.decisions.length > 0);
  for (const decision of result.decisions) {
    assert.deepEqual(validateCreatorDecision(decision), []);
    assert.ok(decision.evidence.length > 0);
    assert.ok(decision.metrics.length > 0);
    assert.match(decision.title.messageKey, /^creatorDecisions\./);
  }
});

test("the engine returns a discriminated failure for invalid normalized input", () => {
  const result = generateCreatorDecisions(
    createDecisionInput({ creatorId: "" }),
  );
  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }
  assert.equal(result.decisions.length, 0);
  assert.ok(result.issues.some((issue) => issue.field === "creatorId"));
});

