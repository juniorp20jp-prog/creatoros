import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";

function keys(value: unknown, prefix = ""): ReadonlyArray<string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Readonly<Record<string, unknown>>).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key)).sort();
}

test("strategic experiences expose identical real-mode contracts in four locales", () => {
  for (const section of ["creatorIntelligence", "creatorDecisions"] as const) {
    const expected = keys(en.blueprint[section].realMode);
    assert.deepEqual(keys(es.blueprint[section].realMode), expected);
    assert.deepEqual(keys(fr.blueprint[section].realMode), expected);
    assert.deepEqual(keys(ptBR.blueprint[section].realMode), expected);
  }
});

test("Creator Intelligence and Decision Center default to real mode with explicit Demo opt-in", async () => {
  const [intelligencePage, decisionPage] = await Promise.all([
    readFile(new URL("../../../app/[locale]/creator-intelligence/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../app/[locale]/decisions/page.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [intelligencePage, decisionPage]) {
    assert.match(source, /first\(query\.mode\) !== "demo"/);
    assert.match(source, /requestedAnalysisRunId/);
    assert.match(source, /mode: "demo"|mode="demo"|CreatorIntelligenceWorkspace/);
  }
});

test("real experiences use only typed frontend integration hooks and persisted API output", async () => {
  const sources = await Promise.all([
    readFile(new URL("../real-creator-intelligence-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../creator-decisions/real-creator-decision-experience.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of sources) {
    assert.match(source, /AnalysisApiClient/);
    assert.match(source, /useAnalysisList\(/);
    assert.match(source, /useAnalysis\(/);
    assert.match(source, /strategicProjection/);
    assert.match(source, /schemaVersion !== 1/);
    assert.doesNotMatch(source, /from "\.\.\/\.\.\/core"|Prisma|DATABASE_URL|RawChannelData/);
    assert.doesNotMatch(source, /fixture|youtubeAnalyzerScenarios/);
  }
});

test("runtime composes connected YouTube through the strategic pipeline while fixture path stays unchanged", async () => {
  const runtime = await readFile(new URL("../../../server/analysis-api/runtime.ts", import.meta.url), "utf8");
  assert.match(runtime, /new ConnectedYouTubeStrategicPipeline\(\)/);
  assert.match(runtime, /adapter: new FixtureChannelDataAdapter/);
  assert.equal((runtime.match(/new ConnectedYouTubeStrategicPipeline\(\)/g) ?? []).length, 1);
});

test("navigation preserves the selected run from Mission Control through both strategic views", async () => {
  const [inspector, intelligenceHeader, decisionHeader] = await Promise.all([
    readFile(new URL("../../mission-control-analysis/components/AnalysisInspector.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/IntelligenceHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../creator-decisions/components/DecisionCenterHeader.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(inspector, /creator-intelligence\?analysisRunId=/);
  assert.match(inspector, /decisions\?analysisRunId=/);
  assert.match(intelligenceHeader, /decisions.*analysisRunId/s);
  assert.match(decisionHeader, /creator-intelligence.*analysisRunId/s);
});

test("real states are accessible, responsive and do not silently fall back to Demo", async () => {
  const [intelligence, decisions, intelligenceCss, decisionsCss] = await Promise.all([
    readFile(new URL("../real-creator-intelligence-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../creator-decisions/real-creator-decision-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../creator-intelligence.module.css", import.meta.url), "utf8"),
    readFile(new URL("../../creator-decisions/creator-decisions.module.css", import.meta.url), "utf8"),
  ]);
  for (const source of [intelligence, decisions]) {
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /reanalysis/);
    assert.match(source, /retry/);
  }
  for (const css of [intelligenceCss, decisionsCss]) {
    assert.match(css, /@media \(max-width: 620px\)/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /focus-visible/);
  }
});