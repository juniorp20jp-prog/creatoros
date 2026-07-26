import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCreatorAnalysisRunRecord,
  serializeCreatorAnalysisRun,
  type CreatorAnalysisRunRecord,
} from "../persistence";
import { createCompletedAnalysisRunFixture } from "./fixtures/creator-analysis-run-fixtures";

async function validRecord(): Promise<CreatorAnalysisRunRecord> {
  return serializeCreatorAnalysisRun(await createCompletedAnalysisRunFixture());
}

test("the parser accepts a valid V1 record", async () => {
  const result = parseCreatorAnalysisRunRecord(await validRecord());
  assert.equal(result.status, "valid");
});

test("unsupported future schema versions are rejected explicitly", async () => {
  const record: unknown = { ...(await validRecord()), schemaVersion: 2 };
  const result = parseCreatorAnalysisRunRecord(record);
  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.equal(result.error.code, "unsupported-schema-version");
  }
});

test("missing required fields are rejected", async () => {
  const { id: _id, ...record } = await validRecord();
  const result = parseCreatorAnalysisRunRecord(record);
  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.ok(result.error.issues.some((entry) => entry.path === "record.id"));
  }
});

test("non-canonical persisted timestamps are rejected", async () => {
  const record = { ...(await validRecord()), createdAt: "2026-07-20" };
  const result = parseCreatorAnalysisRunRecord(record);
  assert.equal(result.status, "invalid");
});

test("undefined and non-plain objects are rejected", async () => {
  const withUndefined = {
    ...(await validRecord()),
    unsupported: undefined,
  };
  const withMap = { ...(await validRecord()), unsupported: new Map() };
  const undefinedResult = parseCreatorAnalysisRunRecord(withUndefined);
  const mapResult = parseCreatorAnalysisRunRecord(withMap);
  assert.equal(undefinedResult.status, "invalid");
  assert.equal(mapResult.status, "invalid");
});

test("circular references are rejected", async () => {
  const record: Record<string, unknown> = { ...(await validRecord()) };
  record.circular = record;
  const result = parseCreatorAnalysisRunRecord(record);
  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.ok(
      result.error.issues.some((entry) => entry.code === "circular-reference"),
    );
  }
});

test("source and input channel identities must agree", async () => {
  const record = structuredClone(await validRecord());
  const mutable = record as CreatorAnalysisRunRecord & {
    source: { channel: { id: string } };
  };
  mutable.source.channel.id = "another-channel";
  const result = parseCreatorAnalysisRunRecord(record);
  assert.equal(result.status, "invalid");
});

test("record and analysis statuses must agree", async () => {
  const record = { ...(await validRecord()), status: "failed" };
  const result = parseCreatorAnalysisRunRecord(record);
  assert.equal(result.status, "invalid");
});

test("duplicate persisted decision IDs are rejected", async () => {
  const record = structuredClone(await validRecord());
  const decisions = record.snapshots.decisions;
  assert.equal(decisions?.status, "completed");
  if (decisions?.status === "completed" && decisions.decisions[0]) {
    const mutable = decisions.decisions as Array<(typeof decisions.decisions)[number]>;
    mutable.push(structuredClone(decisions.decisions[0]));
  }
  const result = parseCreatorAnalysisRunRecord(record);
  assert.equal(result.status, "invalid");
});
