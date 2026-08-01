import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const analysisRoutes = [
  "app/api/internal/v1/analysis-runs/route.ts",
  "app/api/internal/v1/analysis-runs/status-summary/route.ts",
  "app/api/internal/v1/analysis-runs/[analysisRunId]/route.ts",
  "app/api/internal/v1/analysis-runs/[analysisRunId]/history/route.ts",
  "app/api/internal/v1/analysis-runs/[analysisRunId]/replay/route.ts",
] as const;

test("every Internal Analysis API Route Handler uses the reusable session protection boundary", async () => {
  for (const route of analysisRoutes) {
    const source = await readFile(new URL(`../../../${route}`, import.meta.url), "utf8");
    assert.match(source, /runtime\.auth\.protect\(/);
    assert.doesNotMatch(source, /Prisma|SessionRow|tokenHash/);
  }
});

test("auth Route Handlers are dynamic Node.js server boundaries", async () => {
  for (const route of ["google/route.ts", "google/callback/route.ts", "session/route.ts", "logout/route.ts"]) {
    const source = await readFile(new URL(`../../../app/api/auth/${route}`, import.meta.url), "utf8");
    assert.match(source, /dynamic = "force-dynamic"/);
    assert.match(source, /runtime = "nodejs"/);
  }
});
