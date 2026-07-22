import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function componentSource(name: string): Promise<string> {
  return readFile(new URL(`../components/${name}.tsx`, import.meta.url), "utf8");
}

test("decision card exposes semantic action, evidence, metrics and alternatives", async () => {
  const source = await componentSource("DecisionCard");
  assert.match(source, /<article/);
  assert.match(source, /aria-labelledby=/);
  assert.match(source, /<h3 id=/);
  assert.match(source, /content\.sections\.action/);
  assert.match(source, /content\.sections\.metrics/);
  assert.match(source, /<details/);
  assert.match(source, /<summary>/);
  assert.match(source, /DecisionEvidenceList/);
  assert.match(source, /DecisionAlternatives/);
  assert.match(source, /decision\.priorityLabel/);
  assert.match(source, /decision\.confidenceLabel/);
});

test("filter form uses labeled keyboard-operable native controls", async () => {
  const source = await componentSource("DecisionFilters");
  assert.match(source, /<form/);
  assert.equal((source.match(/<select/g) ?? []).length, 2);
  assert.match(source, /type="submit"/);
  assert.match(source, /name="priority"/);
  assert.match(source, /name="category"/);
  assert.equal((source.match(/<label>/g) ?? []).length, 2);
});

test("empty and insufficient states use distinct content contracts", async () => {
  const source = await componentSource("DecisionStates");
  assert.match(source, /state === "empty"/);
  assert.match(source, /emptyTitle/);
  assert.match(source, /insufficientTitle/);
  assert.match(source, /aria-labelledby="decision-state-title"/);
});

test("controlled errors use an alert without rendering raw error data", async () => {
  const source = await componentSource("DecisionStates");
  assert.match(source, /role=\{state\.includes\("error"\) \? "alert" : "status"\}/);
  assert.doesNotMatch(source, /errorCode|error\.stack|digest/);
});

test("native disclosure keeps the primary action outside expandable detail", async () => {
  const source = await componentSource("DecisionCard");
  const actionPosition = source.indexOf("content.sections.action");
  const detailsPosition = source.indexOf("<details");
  assert.ok(actionPosition > 0);
  assert.ok(detailsPosition > actionPosition);
});

