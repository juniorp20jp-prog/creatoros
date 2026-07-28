import assert from "node:assert/strict";
import { test } from "node:test";

import {
  planAnalysisRunRetention,
  type AnalysisRun,
} from "../persistence";

const evaluatedAt = "2026-07-20T00:00:00.000Z";

function createRun(
  analysisRunId: string,
  channelId: string,
  createdAt: string,
): AnalysisRun {
  return {
    schemaVersion: 2,
    revision: 1,
    analysisRunId,
    creatorId: `creator_${channelId}`,
    channelId,
    status: "pending",
    source: {
      sourceType: "local-fixture",
      sourceSchemaVersion: "1",
    },
    adapterWarnings: [],
    pipelineVersion: "1.0.0",
    createdAt,
    updatedAt: createdAt,
    attempt: 1,
  };
}

const history = [
  createRun(
    "channel_a_new",
    "channel_a",
    "2026-07-15T00:00:00.000Z",
  ),
  createRun(
    "channel_a_middle",
    "channel_a",
    "2026-06-20T00:00:00.000Z",
  ),
  createRun(
    "channel_a_old",
    "channel_a",
    "2026-05-01T00:00:00.000Z",
  ),
  createRun(
    "channel_b_new",
    "channel_b",
    "2026-07-10T00:00:00.000Z",
  ),
  createRun(
    "channel_b_old",
    "channel_b",
    "2026-04-01T00:00:00.000Z",
  ),
] as const;

test("keep-forever retains every analysis run", () => {
  const result = planAnalysisRunRetention(
    history,
    { kind: "keep-forever" },
    { evaluatedAt, dryRun: true },
  );

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.plan.kept.length, history.length);
    assert.equal(result.plan.deletionCandidates.length, 0);
    assert.equal(
      result.plan.kept.every(
        (item) => item.reason === "keep-forever",
      ),
      true,
    );
  }
});

test("max-runs-per-channel applies independently to each channel", () => {
  const result = planAnalysisRunRetention(
    history,
    {
      kind: "max-runs-per-channel",
      maxRuns: 1,
    },
    { evaluatedAt, dryRun: true },
  );

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.deepEqual(
      result.plan.kept.map((item) => item.analysisRunId),
      ["channel_a_new", "channel_b_new"],
    );
    assert.deepEqual(
      result.plan.deletionCandidates.map(
        (item) => item.analysisRunId,
      ),
      ["channel_a_middle", "channel_a_old", "channel_b_old"],
    );
  }
});

test("max-age retains the inclusive cutoff and marks older runs", () => {
  const result = planAnalysisRunRetention(
    history,
    {
      kind: "max-age",
      maxAgeDays: 30,
    },
    { evaluatedAt, dryRun: true },
  );

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.deepEqual(
      result.plan.kept.map((item) => item.analysisRunId),
      ["channel_a_new", "channel_a_middle", "channel_b_new"],
    );
    assert.deepEqual(
      result.plan.deletionCandidates.map(
        (item) => item.analysisRunId,
      ),
      ["channel_a_old", "channel_b_old"],
    );
  }
});

test("protected analysis runs never become deletion candidates", () => {
  const result = planAnalysisRunRetention(
    history,
    {
      kind: "max-runs-per-channel",
      maxRuns: 1,
      protectedAnalysisRunIds: ["channel_a_old"],
    },
    { evaluatedAt, dryRun: true },
  );

  assert.equal(result.status, "success");
  if (result.status === "success") {
    const protectedEntry = result.plan.kept.find(
      (item) => item.analysisRunId === "channel_a_old",
    );
    assert.equal(protectedEntry?.reason, "protected-run");
    assert.equal(
      result.plan.deletionCandidates.some(
        (item) => item.analysisRunId === "channel_a_old",
      ),
      false,
    );
  }
});

test("retention planning is dry-run data and never mutates input", () => {
  const input: AnalysisRun[] = history.map((run) =>
    structuredClone(run),
  );
  const before = structuredClone(input);
  const result = planAnalysisRunRetention(
    input,
    {
      kind: "max-runs-per-channel",
      maxRuns: 1,
    },
    { evaluatedAt, dryRun: true },
  );

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.plan.dryRun, true);
  }
  assert.deepEqual(input, before);
});

test("retention plan ordering is deterministic", () => {
  const policy = {
    kind: "max-age",
    maxAgeDays: 30,
  } as const;
  const options = { evaluatedAt, dryRun: true };

  assert.deepEqual(
    planAnalysisRunRetention(history, policy, options),
    planAnalysisRunRetention([...history].reverse(), policy, options),
  );
});

test("retention planning rejects dangerous policy values", () => {
  const invalidLimit = planAnalysisRunRetention(
    history,
    {
      kind: "max-runs-per-channel",
      maxRuns: 0,
    },
    { evaluatedAt, dryRun: true },
  );
  const duplicateProtection = planAnalysisRunRetention(
    history,
    {
      kind: "keep-forever",
      protectedAnalysisRunIds: ["channel_a_old", "channel_a_old"],
    },
    { evaluatedAt, dryRun: true },
  );

  for (const result of [invalidLimit, duplicateProtection]) {
    assert.equal(result.status, "failure");
    if (result.status === "failure") {
      assert.equal(result.error.code, "invalid-policy");
    }
  }
});
