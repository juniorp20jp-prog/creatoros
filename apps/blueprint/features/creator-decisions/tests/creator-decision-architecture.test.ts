import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";

function objectKeys(value: unknown, prefix = ""): ReadonlyArray<string> {
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return [prefix];
  }
  return Object.entries(value as Readonly<Record<string, unknown>>).flatMap(
    ([key, child]) => objectKeys(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

test("Decision Center translation keys match in every supported locale", () => {
  const expected = [...objectKeys(en.blueprint.creatorDecisions)].sort();
  assert.deepEqual([...objectKeys(es.blueprint.creatorDecisions)].sort(), expected);
  assert.deepEqual([...objectKeys(fr.blueprint.creatorDecisions)].sort(), expected);
  assert.deepEqual([...objectKeys(ptBR.blueprint.creatorDecisions)].sort(), expected);
});

test("Decision Center page uses only the public analytics and decision APIs", async () => {
  const source = await readFile(
    new URL("../../../app/[locale]/decisions/page.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((source.match(/executeYouTubeIntelligence\(/g) ?? []).length, 1);
  assert.equal(
    (source.match(/generateCreatorDecisionsFromYouTubeAnalytics\(/g) ?? [])
      .length,
    1,
  );
  assert.doesNotMatch(source, /decision-engine\/rules|THRESHOLDS|Rule\.evaluate/);
});

test("Decision Center route includes loading and controlled error boundaries", async () => {
  const files = await readdir(
    new URL("../../../app/[locale]/decisions", import.meta.url),
  );
  assert.ok(files.includes("page.tsx"));
  assert.ok(files.includes("loading.tsx"));
  assert.ok(files.includes("error.tsx"));
});

test("Blueprint navigation points Decisions to the localized route", async () => {
  const source = await readFile(
    new URL(
      "../../../components/blueprint/layout/BlueprintSidebar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /href: `\/\$\{locale\}\/decisions`/);
  assert.doesNotMatch(source, /#decisions/);
});

test("responsive and focus-visible rules cover critical interactions", async () => {
  const css = await readFile(
    new URL("../creator-decisions.module.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /height:\s*\d+px/);
});

test("presentation components do not import decision rules or scoring", async () => {
  const directory = new URL("../components", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".tsx"));
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, `${directory.href}/`), "utf8")),
  );
  for (const source of sources) {
    assert.doesNotMatch(source, /core\/decisions|THRESHOLDS|confidence\.score\s*[+*/-]/);
  }
});
