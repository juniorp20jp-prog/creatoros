import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const component = read("features/youtube-analyzer/components/RealYouTubeAnalyzerExperience.tsx");
const page = read("app/[locale]/youtube-analyzer/page.tsx");
const css = read("features/youtube-analyzer/youtube-analyzer.module.css");

test("real intelligence is primary and demo fixtures require explicit selection", () => {
  assert.ok(component.includes("synchronizeAndAnalyze"));
  assert.ok(component.includes("createRealYouTubeAnalyzerViewModel"));
  assert.ok(page.includes('requestedScenario === undefined\n      ? null'));
  assert.equal(page.includes('requestedScenario === undefined\n      ? "complete"'), false);
});

test("real analyzer discloses coverage and never renders fabricated Analytics metrics", () => {
  assert.ok(component.includes("coverageCount"));
  assert.ok(component.includes("coverageLimit"));
  assert.ok(component.includes("excludedVideoCount"));
  for (const fabricated of [
    "impressions:",
    "ctr:",
    "averageViewDurationSeconds:",
    "averagePercentageViewed:",
    "subscribersGained:",
    "revenue:",
  ]) assert.equal(component.includes(fabricated), false);
});

test("real analyzer exposes semantic live states, buttons, responsive and reduced motion", () => {
  assert.ok(component.includes('aria-live="polite"'));
  assert.ok(component.includes('role="alert"'));
  assert.ok(component.includes("<Button"));
  assert.ok(css.includes("@media (max-width: 48rem)"));
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"));
  assert.match(
    css,
    /\.realWorkspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/su,
  );
  assert.match(
    css,
    /\.realAnalysis\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/su,
  );
});

test("all four locale dictionaries contain the real analyzer contract", () => {
  for (const locale of ["es", "en", "fr", "pt-BR"]) {
    const parsed: unknown = JSON.parse(
      readFileSync(join(root, "messages", `${locale}.json`), "utf8"),
    );
    assert.ok(isRecord(parsed));
    const blueprint = isRecord(parsed.blueprint) ? parsed.blueprint : undefined;
    const analyzer = isRecord(blueprint?.youtubeAnalyzer)
      ? blueprint.youtubeAnalyzer
      : undefined;
    const real = isRecord(analyzer?.realAnalyzer)
      ? analyzer.realAnalyzer
      : undefined;
    assert.ok(real);
    for (const key of [
      "title",
      "action",
      "loading",
      "emptyTitle",
      "errorTitle",
      "coverageExact",
      "coverageTruncated",
      "realDataNotice",
    ]) assert.equal(typeof real[key], "string");
  }
});

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
