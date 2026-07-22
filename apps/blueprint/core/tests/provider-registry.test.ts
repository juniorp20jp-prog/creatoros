import assert from "node:assert/strict";
import { test } from "node:test";

import { ProviderRegistry } from "../providers";
import { DefaultExecutionContextFactory } from "../services";
import {
  FixedIdGenerator,
  SequenceClock,
  TestProvider,
  type TestProviderRequest,
  type TestProviderResponse,
} from "./fixtures/core-fixtures";

test("ProviderRegistry registers a valid provider", () => {
  const registry = new ProviderRegistry();

  registry.register(new TestProvider());

  assert.equal(registry.has("test-provider"), true);
  assert.equal(registry.list().length, 1);
  assert.equal(registry.list()[0]?.id, "test-provider");
});

test("ProviderRegistry resolves a registered provider", () => {
  const registry = new ProviderRegistry();
  const provider = new TestProvider();
  registry.register(provider);

  const resolved = registry.resolve<
    TestProviderRequest,
    TestProviderResponse
  >("test-provider");

  assert.equal(resolved, provider);
});

test("ProviderRegistry rejects duplicate providers", () => {
  const registry = new ProviderRegistry();
  registry.register(new TestProvider());

  assert.throws(
    () => registry.register(new TestProvider()),
    /AI provider "test-provider" is already registered/,
  );
});

test("ProviderRegistry returns a clear error for a missing provider", () => {
  const registry = new ProviderRegistry();

  assert.throws(
    () =>
      registry.resolve<TestProviderRequest, TestProviderResponse>(
        "missing-provider",
      ),
    /AI provider "missing-provider" is not registered/,
  );
});

test("ProviderRegistry metadata and provider results do not expose secrets", async () => {
  const secret = "private-test-key";
  const registry = new ProviderRegistry();
  registry.register(new TestProvider(secret));

  const provider = registry.resolve<
    TestProviderRequest,
    TestProviderResponse
  >("test-provider");
  const context = new DefaultExecutionContextFactory(
    new SequenceClock(["2026-07-20T12:00:00.000Z"]),
    new FixedIdGenerator(),
  ).create({ engineId: "test-engine" });
  const result = await provider.execute({ prompt: "hello" }, context);

  assert.equal(JSON.stringify(registry.list()).includes(secret), false);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.deepEqual(result, { outputCode: "processed:hello" });
});
