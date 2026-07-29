import assert from "node:assert/strict";
import { test } from "node:test";

import { mapPersistenceRecordToAnalysisRun } from "../persistence";
import { mapPrismaRowToAnalysisRunRecord } from "../persistence/prisma/prisma-analysis-run-row-mapper";
import type { AnalysisRunRow } from "../persistence/prisma/generated/client";

test("Prisma row mapper returns the provider-neutral persistence shape", () => {
  const row: AnalysisRunRow = {
    analysisRunId: "row_mapper",
    creatorId: "creator_test",
    channelId: "channel_test",
    status: "pending",
    schemaVersion: 2,
    revision: 1,
    source: {
      sourceType: "local-fixture",
      sourceSchemaVersion: "1",
    },
    adapterMetadata: null,
    adapterWarnings: [],
    pipelineVersion: "1.0.0",
    analysisResult: null,
    failure: null,
    correlationId: null,
    attempt: 1,
    retryOfAnalysisRunId: null,
    createdAt: new Date("2026-07-20T13:00:00.000Z"),
    updatedAt: new Date("2026-07-20T13:00:00.000Z"),
    completedAt: null,
  };

  const record = mapPrismaRowToAnalysisRunRecord(row);
  const domain = mapPersistenceRecordToAnalysisRun(record);

  assert.equal(domain.status, "success");
  assert.equal("adapterMetadata" in record, false);
  assert.equal("analysisResult" in record, false);
  assert.equal(JSON.stringify(record).includes("RawChannelData"), false);
});
