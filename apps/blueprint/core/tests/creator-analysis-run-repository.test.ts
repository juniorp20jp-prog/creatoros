import assert from "node:assert/strict";
import test from "node:test";
import {
  CreatorAnalysisRunPersistenceError,
  InMemoryCreatorAnalysisRunRepository,
  serializeCreatorAnalysisRun,
  type CreatorAnalysisRunRecord,
} from "../persistence";
import { createCompletedAnalysisRunFixture } from "./fixtures/creator-analysis-run-fixtures";

async function record(
  options: Parameters<typeof createCompletedAnalysisRunFixture>[0] = {},
): Promise<CreatorAnalysisRunRecord> {
  return serializeCreatorAnalysisRun(
    await createCompletedAnalysisRunFixture(options),
  );
}

test("saving and retrieving a record returns equivalent data", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  const source = await record();
  await repository.save(source);
  assert.deepEqual(await repository.findById(source.id), source);
});

test("repository ingress and egress use defensive copies", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  const source = await record();
  const saved = await repository.save(source);
  const retrieved = await repository.findById(source.id);
  assert.notStrictEqual(saved, source);
  assert.notStrictEqual(retrieved, source);
  assert.notStrictEqual(retrieved?.source, source.source);
});

test("mutating a retrieved record does not mutate stored state", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  const source = await record();
  await repository.save(source);
  const retrieved = await repository.findById(source.id);
  assert.ok(retrieved);
  const mutable = retrieved as CreatorAnalysisRunRecord & {
    source: { channel: { name: string } };
  };
  mutable.source.channel.name = "Changed";
  assert.equal((await repository.findById(source.id))?.source.channel.name, source.source.channel.name);
});

test("mutating a source object after save does not mutate stored state", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  const source = await record();
  await repository.save(source);
  const mutable = source as CreatorAnalysisRunRecord & {
    metadata: { attributes: Record<string, string> };
  };
  mutable.metadata.attributes.scenario = "changed";
  assert.equal(
    (await repository.findById(source.id))?.metadata.attributes.scenario,
    "complete",
  );
});

test("unknown IDs return null", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  assert.equal(await repository.findById("missing"), null);
});

test("save uses deterministic upsert semantics by ID", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  const first = await record({ id: "same", updatedAt: "2026-07-20T08:05:00-04:00" });
  const replacement = await record({
    id: "same",
    updatedAt: "2026-07-20T09:05:00-04:00",
    locale: "fr",
  });
  await repository.save(first);
  await repository.save(replacement);
  assert.equal((await repository.listRecent()).length, 1);
  assert.deepEqual(await repository.findById("same"), replacement);
});

test("multiple records use documented recent ordering and limit", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  const oldest = await record({ id: "oldest", updatedAt: "2026-07-20T08:01:00-04:00" });
  const newestB = await record({ id: "b", updatedAt: "2026-07-20T09:01:00-04:00" });
  const newestA = await record({ id: "a", updatedAt: "2026-07-20T09:01:00-04:00" });
  await repository.save(oldest);
  await repository.save(newestB);
  await repository.save(newestA);
  assert.deepEqual(
    (await repository.listRecent()).map((item) => item.id),
    ["a", "b", "oldest"],
  );
  assert.deepEqual(
    (await repository.listRecent(2)).map((item) => item.id),
    ["a", "b"],
  );
});

test("invalid records are rejected at the repository boundary", async () => {
  const repository = new InMemoryCreatorAnalysisRunRepository();
  const invalid = { ...(await record()), id: "" } as CreatorAnalysisRunRecord;
  await assert.rejects(
    repository.save(invalid),
    (error: unknown) =>
      error instanceof CreatorAnalysisRunPersistenceError &&
      error.code === "invalid-record",
  );
});

test("repository instances do not share global state", async () => {
  const first = new InMemoryCreatorAnalysisRunRepository();
  const second = new InMemoryCreatorAnalysisRunRepository();
  const source = await record();
  await first.save(source);
  assert.equal(await second.findById(source.id), null);
});
