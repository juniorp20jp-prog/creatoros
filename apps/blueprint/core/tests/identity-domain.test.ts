import assert from "node:assert/strict";
import { test } from "node:test";

import { createIdentity, createUser } from "../identity";
import { identityInput, userInput } from "./fixtures/authentication-fixtures";

test("User normalizes email and applies an active default", () => {
  const result = createUser(userInput);
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.value.email, "creator@example.com");
    assert.equal(result.value.status, "active");
    assert.equal(result.value.updatedAt, result.value.createdAt);
  }
});

test("User rejects invalid email, locale, timezone, and timestamps", () => {
  for (const input of [
    { ...userInput, email: "invalid" },
    { ...userInput, locale: "de" },
    { ...userInput, timezone: "Not/AZone" },
    { ...userInput, createdAt: "yesterday" },
  ]) {
    const result = createUser(input as typeof userInput);
    assert.equal(result.status, "failure");
  }
});

test("Identity remains provider-neutral and validates identifiers", () => {
  const result = createIdentity(identityInput);
  assert.equal(result.status, "success");
  assert.equal(JSON.stringify(result).includes("provider"), false);
  assert.equal(createIdentity({ ...identityInput, identityId: " " }).status, "failure");
});
