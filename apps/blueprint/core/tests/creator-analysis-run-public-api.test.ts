import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATOR_ANALYSIS_RUN_SCHEMA_VERSION,
  InMemoryCreatorAnalysisRunRepository,
  deserializeCreatorAnalysisRun,
  parseCreatorAnalysisRunRecord,
  serializeCreatorAnalysisRun,
} from "../index";

test("Core exposes the intended analysis-run persistence API", () => {
  assert.equal(CREATOR_ANALYSIS_RUN_SCHEMA_VERSION, 1);
  assert.equal(typeof InMemoryCreatorAnalysisRunRepository, "function");
  assert.equal(typeof serializeCreatorAnalysisRun, "function");
  assert.equal(typeof deserializeCreatorAnalysisRun, "function");
  assert.equal(typeof parseCreatorAnalysisRunRecord, "function");
});
