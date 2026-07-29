import assert from "node:assert/strict";
import { test } from "node:test";

import { requireDatabaseUrl } from "../persistence/prisma/database-url";

test("PostgreSQL configuration fails clearly without DATABASE_URL", () => {
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required/);
});

test("PostgreSQL configuration returns an injected URL without logging it", () => {
  const value = "postgresql://user:private-value@localhost:5432/test";
  assert.equal(requireDatabaseUrl({ DATABASE_URL: value }), value);
});
