import {
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import {
  extname,
  join,
  resolve,
} from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");

const legacyButtonDirectories = [
  "apps/web/components/shared/ui/Button",
  "apps/blueprint/components/shared/ui/Button",
] as const;

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(
    (entry) => {
      const entryPath = join(directory, entry.name);

      return entry.isDirectory()
        ? collectFiles(entryPath)
        : [entryPath];
    },
  );
}

function removeCssComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

describe("Button architecture", () => {
  it.each(legacyButtonDirectories)(
    "keeps %s removed or backed by @repo/ui",
    (relativeDirectory) => {
      const directory = join(repositoryRoot, relativeDirectory);

      if (!existsSync(directory)) {
        return;
      }

      const files = collectFiles(directory);
      const sourceFiles = files.filter((file) =>
        [".ts", ".tsx"].includes(extname(file)),
      );
      const cssFiles = files.filter(
        (file) => extname(file) === ".css",
      );
      const combinedSource = sourceFiles
        .map((file) => readFileSync(file, "utf8"))
        .join("\n");

      expect(combinedSource).toMatch(
        /from\s+["']@repo\/ui(?:\/button)?["']/,
      );

      for (const cssFile of cssFiles) {
        expect(
          removeCssComments(readFileSync(cssFile, "utf8")),
        ).toBe("");
      }
    },
  );
});
