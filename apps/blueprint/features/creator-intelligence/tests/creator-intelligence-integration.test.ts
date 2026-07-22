import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

test("page executes YouTube analytics once, then interpreter, then View Model", async () => {
  const source = await readFile(
    new URL("../../../app/[locale]/creator-intelligence/page.tsx", import.meta.url),
    "utf8",
  );
  const executeIndex = source.indexOf("executeYouTubeIntelligence(input");
  const interpretIndex = source.indexOf(
    "interpretCreatorIntelligence(analyticsResult)",
  );
  const viewModelIndex = source.indexOf(
    "createCreatorIntelligenceViewModel(",
  );

  assert.ok(executeIndex >= 0);
  assert.ok(interpretIndex > executeIndex);
  assert.ok(viewModelIndex > interpretIndex);
  assert.equal(source.match(/executeYouTubeIntelligence\(input/g)?.length, 1);
});

test("page safely reuses the Analyzer fixture source", async () => {
  const source = await readFile(
    new URL("../../../app/[locale]/creator-intelligence/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /youtubeAnalyzerScenarios\[scenarioId\]/);
  assert.doesNotMatch(source, /fixtures\/complete-analysis\.fixture/);
});

test("presentation does not import analytical formulas or thresholds", async () => {
  const featureDirectory = new URL("../", import.meta.url);
  const directories = [
    new URL("../components/", import.meta.url),
    new URL("../model/", import.meta.url),
  ];
  const sources: Array<string> = [];
  for (const directory of directories) {
    const files = (await readdir(directory)).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
    );
    sources.push(
      ...(await Promise.all(
        files.map((file) => readFile(new URL(file, directory), "utf8")),
      )),
    );
  }
  sources.push(
    await readFile(new URL("../creator-intelligence-workspace.tsx", import.meta.url), "utf8"),
  );

  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /youtube-intelligence\/(statistics|thresholds|signals|validation)/,
    );
    assert.doesNotMatch(source, /calculate[A-Z]|median\(|average\(/);
  }
  assert.ok(featureDirectory.href.length > 0);
});

test("Dashboard and sidebar expose Creator Intelligence as available", async () => {
  const [registry, sidebar] = await Promise.all([
    readFile(new URL("../../blueprint-dashboard/module-registry.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../../components/blueprint/layout/BlueprintSidebar.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    registry,
    /id: "creatorIntelligence"[^\n]+route: "creator-intelligence"[^\n]+availability: "available"/,
  );
  assert.match(sidebar, /creator-intelligence/);
  assert.match(sidebar, /content\.creatorIntelligence/);
});

test("Analyzer and Intelligence preserve scenario in bidirectional links", async () => {
  const [analyzerHeader, intelligenceHeader] = await Promise.all([
    readFile(
      new URL("../../youtube-analyzer/components/AnalyzerHeader.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../components/IntelligenceHeader.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(analyzerHeader, /creator-intelligence.*scenario=/s);
  assert.match(intelligenceHeader, /youtube-analyzer\$\{scenarioQuery\}/);
});

test("Core interpreter has no framework, provider, or generative AI dependency", async () => {
  const source = await readFile(
    new URL(
      "../../../core/intelligence/creator-intelligence/creator-intelligence-interpreter.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /from "(react|next|openai|anthropic|@google)/i);
  assert.doesNotMatch(source, /\.css"/);
});
