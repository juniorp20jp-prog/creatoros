import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");
const tokensPath = join(sourceDirectory, "styles", "tokens.css");
const tokenDefinitionPattern = /(--[a-z0-9-]+)\s*:/g;
const tokenUsagePattern = /var\((--[a-z0-9-]+)/g;

function collectCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectCssFiles(entryPath);
    }

    return extname(entry.name) === ".css" ? [entryPath] : [];
  });
}

function matches(content: string, pattern: RegExp): string[] {
  return Array.from(content.matchAll(pattern), (match) => match[1]).filter(
    (token): token is string => token !== undefined,
  );
}

describe("design tokens", () => {
  it("defines every token referenced by package CSS", () => {
    const definedTokens = new Set(
      matches(readFileSync(tokensPath, "utf8"), tokenDefinitionPattern),
    );
    const missingTokens = new Set<string>();

    for (const cssFile of collectCssFiles(sourceDirectory)) {
      const usedTokens = matches(
        readFileSync(cssFile, "utf8"),
        tokenUsagePattern,
      );

      for (const token of usedTokens) {
        if (!definedTokens.has(token)) {
          missingTokens.add(token);
        }
      }
    }

    expect([...missingTokens].sort()).toEqual([]);
  });

  it("does not define the same official token twice", () => {
    const definitions = matches(
      readFileSync(tokensPath, "utf8"),
      tokenDefinitionPattern,
    );
    const uniqueDefinitions = new Set(definitions);

    expect(uniqueDefinitions.size).toBe(definitions.length);
  });
});
