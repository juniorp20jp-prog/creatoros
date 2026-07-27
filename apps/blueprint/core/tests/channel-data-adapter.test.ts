import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  FixtureChannelDataAdapter,
  fixtureChannelData,
  type ChannelDataAdapter,
} from "../index";
import type { Clock } from "../services";

class FixedClock implements Clock {
  now(): string {
    return "2026-07-20T13:00:00.000Z";
  }
}

function createAdapter() {
  return new FixtureChannelDataAdapter(new FixedClock());
}

test("ChannelDataAdapter contract exposes a typed versioned definition", () => {
  const adapter = createAdapter() satisfies ChannelDataAdapter<unknown>;

  assert.deepEqual(adapter.definition, {
    adapterId: "fixture-channel-data",
    adapterVersion: "1.0.0",
    sourceType: "local-fixture",
    supportedSchemaVersion: "1",
  });
});

test("fixture adapter transforms complete source data to RawChannelData", () => {
  const result = createAdapter().adapt(fixtureChannelData.complete);

  assert.equal(result.status, "success");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.metadata.processedAt,
    "2026-07-20T13:00:00.000Z",
  );

  if (result.status === "success") {
    assert.equal(
      result.rawChannelData.creator.id,
      "creator_fixture_complete",
    );
    assert.equal(
      result.rawChannelData.channel.subscribers,
      1_000,
    );
    assert.equal(result.rawChannelData.videos.length, 3);
    assert.deepEqual(result.rawChannelData.videos[0], {
      id: "fixture_video_1",
      publishedAt: "2026-07-01T12:00:00.000Z",
      views: 200,
      likes: 10,
      comments: 2,
      durationSeconds: 600,
    });
  }
});

test("fixture adapter returns partial data and typed missing-field warnings", () => {
  const result = createAdapter().adapt(fixtureChannelData.partial);

  assert.equal(result.status, "partial");
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.every(
      (warning) =>
        warning.code === "MISSING_OPTIONAL_FIELD",
    ),
    true,
  );

  if (result.status === "partial") {
    assert.equal(
      result.rawChannelData.channel.totalViews,
      undefined,
    );
    assert.equal(
      result.rawChannelData.videos[0]?.likes,
      undefined,
    );
  }
});

test("fixture adapter supports a valid channel without videos", () => {
  const result = createAdapter().adapt(fixtureChannelData.noVideos);

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.deepEqual(result.rawChannelData.videos, []);
    assert.equal(result.rawChannelData.channel.totalVideos, 0);
  }
});

test("fixture adapter rejects negative numbers without correcting them", () => {
  const result = createAdapter().adapt(
    fixtureChannelData.invalidMetrics,
  );

  assert.equal(result.status, "failure");
  assert.equal("rawChannelData" in result, false);
  assert.equal(
    result.errors.some(
      (error) =>
        error.code === "NEGATIVE_NUMBER" &&
        error.path === "$.channel.subscriberCount",
    ),
    true,
  );
});

test("fixture adapter rejects NaN and Infinity explicitly", () => {
  for (const invalidValue of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = createAdapter().adapt({
      ...fixtureChannelData.complete,
      channel: {
        ...fixtureChannelData.complete.channel,
        subscriberCount: invalidValue,
      },
    });

    assert.equal(result.status, "failure");
    assert.equal(
      result.errors.some(
        (error) => error.code === "NON_FINITE_NUMBER",
      ),
      true,
    );
  }
});

test("fixture adapter rejects invalid and non-canonical dates", () => {
  for (const collectedAt of [
    "not-a-date",
    "2026-02-30T00:00:00.000Z",
    "2026-07-20",
  ]) {
    const result = createAdapter().adapt({
      ...fixtureChannelData.complete,
      collectedAt,
    });

    assert.equal(result.status, "failure");
    assert.equal(
      result.errors.some(
        (error) =>
          error.code === "INVALID_DATE" &&
          error.path === "$.collectedAt",
      ),
      true,
    );
  }
});

test("fixture adapter rejects duplicate video identifiers", () => {
  const firstVideo = fixtureChannelData.complete.videos[0];
  const result = createAdapter().adapt({
    ...fixtureChannelData.complete,
    videos: [firstVideo, firstVideo],
  });

  assert.equal(result.status, "failure");
  assert.equal(
    result.errors.some(
      (error) => error.code === "DUPLICATE_VIDEO_ID",
    ),
    true,
  );
});

test("fixture adapter rejects empty identifiers", () => {
  const result = createAdapter().adapt({
    ...fixtureChannelData.complete,
    creator: {
      ...fixtureChannelData.complete.creator,
      creatorId: "   ",
    },
  });

  assert.equal(result.status, "failure");
  assert.equal(
    result.errors.some(
      (error) =>
        error.code === "EMPTY_IDENTIFIER" &&
        error.path === "$.creator.creatorId",
    ),
    true,
  );
});

test("fixture adapter rejects inconsistent creator and channel identities", () => {
  const result = createAdapter().adapt({
    ...fixtureChannelData.complete,
    channel: {
      ...fixtureChannelData.complete.channel,
      ownerCreatorId: "different_creator",
    },
  });

  assert.equal(result.status, "failure");
  assert.equal(
    result.errors.some(
      (error) =>
        error.code === "IDENTITY_MISMATCH" &&
        error.path === "$.channel.ownerCreatorId",
    ),
    true,
  );
});

test("fixture adapter rejects missing required metrics", () => {
  const result = createAdapter().adapt({
    ...fixtureChannelData.complete,
    videos: [
      {
        videoId: "missing_views",
        publishedAt: "2026-07-01T12:00:00.000Z",
      },
    ],
  });

  assert.equal(result.status, "failure");
  assert.equal(
    result.errors.some(
      (error) =>
        error.code === "MISSING_REQUIRED_FIELD" &&
        error.path === "$.videos[0].viewCount",
    ),
    true,
  );
});

test("fixture adapter reports and removes unknown source fields", () => {
  const result = createAdapter().adapt(
    fixtureChannelData.unknownFields,
  );

  assert.equal(result.status, "partial");
  assert.equal(
    result.warnings.filter(
      (warning) => warning.code === "UNKNOWN_FIELD_IGNORED",
    ).length,
    4,
  );

  if (result.status === "partial") {
    const serialized = JSON.stringify(result.rawChannelData);
    assert.doesNotMatch(
      serialized,
      /sourceDebugLabel|sourceInternalCreatorCode|providerRanking|privateSourceNote/,
    );
  }
});

test("fixture adapter rejects unsupported schema versions", () => {
  const result = createAdapter().adapt({
    ...fixtureChannelData.complete,
    schemaVersion: "2",
  });

  assert.equal(result.status, "failure");
  assert.equal(
    result.errors.some(
      (error) => error.code === "UNSUPPORTED_SCHEMA_VERSION",
    ),
    true,
  );
  assert.equal(
    result.metadata.supportedSchemaVersion,
    FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
  );
});

test("fixture adapter output is deterministic with an injected clock", () => {
  const adapter = createAdapter();

  assert.deepEqual(
    adapter.adapt(fixtureChannelData.complete),
    adapter.adapt(fixtureChannelData.complete),
  );
});

test("fixture adapter has no analysis, network, credential, or SDK dependency", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "core",
      "adapters",
      "channel-data",
      "fixture-channel-data-adapter.ts",
    ),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /fetch\(|https?:\/\/|openai|youtube|api[_-]?key|DefaultScoreEngine|RecommendationEngine|CreatorIntelligenceAnalysisPipeline/i,
  );
});
