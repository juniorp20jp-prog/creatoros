import assert from "node:assert/strict";
import test from "node:test";

import type { DecisionMessage } from "../../../core";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";
import { resolveDecisionMessage } from "../formatters";
import {
  filterCreatorDecisions,
  parseCategoryFilter,
  parsePriorityFilter,
} from "../model";
import {
  executeYouTubeIntelligence,
  generateCreatorDecisionsFromYouTubeAnalytics,
} from "../../../core";
import { creatorDecisionScenarios } from "../fixtures";
import { createScenarioViewModel } from "./creator-decision-test-utils";

test("View Model localizes every presentation field without changing priority", async () => {
  const { viewModel } = await createScenarioViewModel("complete", "es");
  assert.equal(viewModel.state, "populated");
  if (viewModel.state !== "populated") {
    return;
  }
  assert.equal(viewModel.decisions.length, 3);
  assert.equal(viewModel.decisions[0]?.priority, "high");
  assert.equal(viewModel.decisions[0]?.priorityLabel, "Alta");
  assert.equal(viewModel.decisions[0]?.confidenceLabel, "Alta");
  assert.match(viewModel.decisions[0]?.recommendedAction ?? "", /Publica/);
});

test("View Model preserves the stable order produced by the engine", async () => {
  const { viewModel } = await createScenarioViewModel("complete");
  assert.equal(viewModel.state, "populated");
  if (viewModel.state !== "populated") {
    return;
  }
  assert.deepEqual(
    viewModel.decisions.map((decision) => decision.ruleId),
    [
      "decision-rule.high-performing-pattern",
      "decision-rule.publishing-inconsistency",
      "decision-rule.low-click-through",
    ],
  );
});

test("View Model exposes evidence, metrics and alternatives", async () => {
  const { viewModel } = await createScenarioViewModel("complete");
  assert.equal(viewModel.state, "populated");
  if (viewModel.state !== "populated") {
    return;
  }
  for (const decision of viewModel.decisions) {
    assert.ok(decision.evidence.length > 0);
    assert.ok(decision.metrics.length > 0);
    assert.ok(decision.alternatives.length > 0);
    assert.ok(decision.evidence.every((item) => item.sourceRef !== ""));
  }
});

test("missing translation keys use the domain fallback text", () => {
  const message: DecisionMessage = {
    messageKey: "creatorDecisions.rules.notRegistered.title",
    defaultMessage: "Safe fallback",
    parameters: {},
  };
  assert.equal(
    resolveDecisionMessage(en.blueprint.creatorDecisions, message),
    "Safe fallback",
  );
});

test("message resolution preserves parameter interpolation", () => {
  const message: DecisionMessage = {
    messageKey: "creatorDecisions.header.activeCount",
    defaultMessage: "{count} decisions",
    parameters: { count: 4 },
  };
  assert.equal(
    resolveDecisionMessage(es.blueprint.creatorDecisions, message),
    "4 decisiones activas generadas",
  );
});

test("all supported locales resolve professional rule copy", async () => {
  const locales = ["es", "en", "fr", "pt-BR"] as const;
  const titles = await Promise.all(
    locales.map(async (locale) => {
      const { viewModel } = await createScenarioViewModel("complete", locale);
      assert.equal(viewModel.state, "populated");
      return viewModel.state === "populated"
        ? viewModel.decisions[0]?.title
        : undefined;
    }),
  );
  assert.equal(new Set(titles).size, 4);
  assert.ok(titles.every((title) => title !== undefined && title.length > 20));
  assert.ok(es.blueprint.creatorDecisions.sections.detected.includes("detectamos"));
  assert.ok(en.blueprint.creatorDecisions.sections.detected.includes("detected"));
  assert.ok(fr.blueprint.creatorDecisions.sections.detected.includes("détecté"));
  assert.ok(ptBR.blueprint.creatorDecisions.sections.detected.includes("detectamos"));
});

test("filter parsing controls unknown values and filtering preserves order", async () => {
  assert.equal(parsePriorityFilter("critical"), "all");
  assert.equal(parseCategoryFilter("unknown"), "all");
  const analytics = await executeYouTubeIntelligence(
    creatorDecisionScenarios.complete,
  );
  const result = generateCreatorDecisionsFromYouTubeAnalytics(analytics);
  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }
  const filtered = filterCreatorDecisions(result.decisions, {
    priority: "high",
    category: "all",
  });
  assert.deepEqual(
    filtered.map((decision) => decision.id),
    result.decisions
      .filter((decision) => decision.priority === "high")
      .map((decision) => decision.id),
  );
});

test("no-decisions fixture produces a true empty state", async () => {
  const { viewModel } = await createScenarioViewModel("no-decisions");
  assert.equal(viewModel.state, "empty");
  assert.equal(viewModel.totalDecisionCount, 0);
});

test("small valid samples produce the distinct insufficient-data state", async () => {
  const { viewModel } = await createScenarioViewModel("insufficient");
  assert.equal(viewModel.state, "insufficient-data");
});

test("invalid analytics produce a controlled validation state", async () => {
  const { viewModel } = await createScenarioViewModel("invalid");
  assert.equal(viewModel.state, "validation-error");
});

test("filters can produce an empty visible result without changing total decisions", async () => {
  const { viewModel } = await createScenarioViewModel("complete", "en", {
    priority: "low",
    category: "all",
  });
  assert.equal(viewModel.state, "populated");
  if (viewModel.state !== "populated") {
    return;
  }
  assert.equal(viewModel.totalDecisionCount, 3);
  assert.equal(viewModel.decisions.length, 0);
});
