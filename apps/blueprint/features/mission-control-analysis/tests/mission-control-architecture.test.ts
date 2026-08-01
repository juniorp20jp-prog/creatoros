import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";

const featureRoot = new URL("../", import.meta.url);

test("Mission Control translations have identical keys in all locales", () => {
  const dictionaries = [en, es, fr, ptBR];
  const expected = flattenKeys(en.blueprint.missionControl);
  for (const dictionary of dictionaries) {
    assert.deepEqual(
      flattenKeys(dictionary.blueprint.missionControl),
      expected,
    );
    assert.ok(dictionary.blueprint.navigation.missionControl.length > 0);
  }
});

test("Mission Control is a localized visible route in the existing shell", async () => {
  const page = await readFile(
    new URL("../../../app/[locale]/mission-control/page.tsx", import.meta.url),
    "utf8",
  );
  const sidebar = await readFile(
    new URL("../../../components/blueprint/layout/BlueprintSidebar.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /MissionControlAnalysisExperience/);
  assert.match(page, /getDictionary\(locale\)/);
  assert.match(sidebar, /`\/\$\{locale\}\/mission-control`/);
});

test("UI uses the frontend integration boundary and excludes persistence internals", async () => {
  const sources = await featureSources();
  for (const [name, source] of sources) {
    assert.doesNotMatch(source, /@prisma|DATABASE_URL|postgresql|\.\.\/\.\.\/core/iu, name);
    assert.doesNotMatch(source, /RawChannelData/u, name);
  }
  const workspace = sources.find(([name]) =>
    name.endsWith("MissionControlAnalysisExperience.tsx"),
  )?.[1];
  assert.ok(workspace);
  for (const hook of [
    "useStatusSummary",
    "useAnalysisList",
    "useAnalysis",
    "useAnalysisHistory",
    "useReplay",
    "useDeleteAnalysis",
  ]) {
    assert.match(workspace, new RegExp(`${hook}\\(`));
  }
});

test("responsive, focus, and reduced-motion safeguards are present", async () => {
  const css = await readFile(
    new URL("../mission-control-analysis.module.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /@media \(max-width: 48rem\)/);
  assert.match(css, /display: block/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /focus-visible|:focus/);
});

test("visible component copy is supplied by the translation contract", async () => {
  const sources = await featureSources();
  for (const [name, source] of sources) {
    if (!name.endsWith(".tsx")) {
      continue;
    }
    assert.doesNotMatch(
      source,
      />\s*(?:Loading|Try again|No analyses|Delete analysis|Run analysis)\s*</u,
      name,
    );
  }
});

async function featureSources(): Promise<ReadonlyArray<[string, string]>> {
  const files = [
    "MissionControlAnalysisExperience.tsx",
    "components/AnalysisInspector.tsx",
    "components/AnalysisList.tsx",
    "components/MissionControlHeader.tsx",
    "components/MissionControlState.tsx",
    "components/StatusSummaryGrid.tsx",
    "formatters.ts",
    "types.ts",
  ];
  return Promise.all(
    files.map(async (name) => [
      name,
      await readFile(new URL(name, featureRoot), "utf8"),
    ] as const),
  );
}

function flattenKeys(
  value: unknown,
  prefix = "",
): ReadonlyArray<string> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  ).sort();
}
