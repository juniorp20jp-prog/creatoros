import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";

test("connection localization has identical critical keys in four locales", () => {
  const keys = (value: object) => Object.keys(value).sort();
  const reference = keys(en.blueprint.youtubeAnalyzer.connection);
  assert.deepEqual(keys(es.blueprint.youtubeAnalyzer.connection), reference);
  assert.deepEqual(keys(fr.blueprint.youtubeAnalyzer.connection), reference);
  assert.deepEqual(keys(ptBR.blueprint.youtubeAnalyzer.connection), reference);
  for (const dictionary of [en, es, fr, ptBR]) {
    assert.equal(dictionary.blueprint.youtubeAnalyzer.connection.connect.length > 0, true);
    assert.equal(dictionary.blueprint.youtubeAnalyzer.connection.noChange.length > 0, true);
    assert.equal(dictionary.blueprint.youtubeAnalyzer.connection.errors.authorization.length > 0, true);
  }
});

test("frontend connection layer does not import Prisma, persistence, Google APIs, or Core", async () => {
  const client = await readFile(new URL("../client/youtube-api-client.ts", import.meta.url), "utf8");
  const hook = await readFile(new URL("../hooks/use-youtube-connection.ts", import.meta.url), "utf8");
  const component = await readFile(new URL("../components/YouTubeConnectionExperience.tsx", import.meta.url), "utf8");
  const source = `${client}\n${hook}\n${component}`;
  assert.doesNotMatch(source, /@prisma|prisma|core\/|googleapis|youtube\/v3|DATABASE_URL/u);
  assert.match(client, /\/api\/youtube\/channel\/sync/u);
});

test("Analyzer keeps the real connection experience separate from demo fixtures", async () => {
  const source = await readFile(new URL("../../youtube-analyzer/youtube-analyzer.tsx", import.meta.url), "utf8");
  assert.match(source, /YouTubeConnectionExperience/u);
  assert.match(source, /demoWorkspace/u);
  assert.match(source, /content\.connection\.demoDescription/u);
});
