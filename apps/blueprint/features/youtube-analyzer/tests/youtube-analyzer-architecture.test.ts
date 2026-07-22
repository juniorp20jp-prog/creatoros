import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";

function objectKeys(value: unknown, prefix = ""): ReadonlyArray<string> {
  if (Array.isArray(value)) {
    return [prefix];
  }
  if (value === null || typeof value !== "object") {
    return [prefix];
  }

  return Object.entries(value as Readonly<Record<string, unknown>>).flatMap(
    ([key, child]) => objectKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

test("Analyzer page executes the public engine and passes its result to the View Model", async () => {
  const pageSource = await readFile(
    new URL(
      "../../../app/[locale]/youtube-analyzer/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(pageSource, /executeYouTubeIntelligence\(input/);
  assert.match(pageSource, /createYouTubeAnalyzerViewModel\(scenarioId, result\)/);
});

test("presentational components do not import engine formulas or thresholds", async () => {
  const componentsDirectory = new URL("../components/", import.meta.url);
  const componentFiles = (await readdir(componentsDirectory)).filter((file) =>
    file.endsWith(".tsx"),
  );
  const sources = await Promise.all(
    componentFiles.map((file) =>
      readFile(new URL(file, componentsDirectory), "utf8"),
    ),
  );

  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /youtube-intelligence\/(statistics|thresholds|signals|validation)/,
    );
  }
});

test("YouTube Analyzer translation keys match in all supported locales", () => {
  const reference = [...objectKeys(en.blueprint.youtubeAnalyzer)].sort();

  assert.deepEqual(
    [...objectKeys(es.blueprint.youtubeAnalyzer)].sort(),
    reference,
  );
  assert.deepEqual(
    [...objectKeys(fr.blueprint.youtubeAnalyzer)].sort(),
    reference,
  );
  assert.deepEqual(
    [...objectKeys(ptBR.blueprint.youtubeAnalyzer)].sort(),
    reference,
  );
});

test("Creator Intelligence translation keys match in all supported locales", () => {
  const reference = [...objectKeys(en.blueprint.creatorIntelligence)].sort();

  assert.deepEqual(
    [...objectKeys(es.blueprint.creatorIntelligence)].sort(),
    reference,
  );
  assert.deepEqual(
    [...objectKeys(fr.blueprint.creatorIntelligence)].sort(),
    reference,
  );
  assert.deepEqual(
    [...objectKeys(ptBR.blueprint.creatorIntelligence)].sort(),
    reference,
  );
});
