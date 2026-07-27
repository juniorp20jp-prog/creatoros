import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

import {
  DefaultChannelDataNormalizer,
  DefaultChannelMetricsCalculator,
  type CreatorProfile,
} from "../engines/creator-intelligence";
import { completeRawChannelData } from "./fixtures/creator-intelligence-analysis-fixtures";

const context = {
  analysisId: "analysis_test",
  analyzedAt: "2026-07-20T13:00:00.000Z",
};

test("domain models represent provider-neutral creator and channel data", () => {
  const creator = {
    id: "creator_test",
    displayName: "Test Creator",
    locale: "es",
  } satisfies CreatorProfile;

  assert.deepEqual(creator, {
    id: "creator_test",
    displayName: "Test Creator",
    locale: "es",
  });

  const source = readFileSync(
    join(
      process.cwd(),
      "core",
      "engines",
      "creator-intelligence",
      "domain-models.ts",
    ),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /youtube|openai|react|next\/|providerId|apiKey/i,
  );
});

test("normalization preserves available values and canonicalizes text and dates", () => {
  const normalizer = new DefaultChannelDataNormalizer();
  const normalized = normalizer.normalize(
    {
      ...completeRawChannelData,
      creator: {
        ...completeRawChannelData.creator,
        displayName: "  Test Creator  ",
      },
    },
    context,
  );

  assert.equal(normalized.creator.displayName, "Test Creator");
  assert.equal(
    normalized.collectedAt,
    "2026-07-20T12:00:00.000Z",
  );
  assert.equal(normalized.videos.length, 3);
  assert.equal(normalized.videos[0]?.videoId, "video_1");
});

test("missing optional metrics remain unavailable", () => {
  const normalizer = new DefaultChannelDataNormalizer();
  const calculator = new DefaultChannelMetricsCalculator();
  const normalized = normalizer.normalize(
    {
      collectedAt: completeRawChannelData.collectedAt,
      creator: {
        id: "creator_test",
      },
      channel: {
        id: "channel_test",
        creatorId: "creator_test",
        subscribers: 0,
      },
      videos: [],
    },
    context,
  );
  const metrics = calculator.calculate(normalized);

  assert.equal(normalized.reportedTotalViews, undefined);
  assert.equal(normalized.reportedVideoCount, undefined);
  assert.equal(metrics.averageEngagementRate, undefined);
  assert.equal(metrics.subscriberReachRate, undefined);
  assert.equal(metrics.analyzedViews, 0);
});

test("normalization rejects invalid domain values", () => {
  const normalizer = new DefaultChannelDataNormalizer();

  assert.throws(
    () =>
      normalizer.normalize(
        {
          ...completeRawChannelData,
          channel: {
            ...completeRawChannelData.channel,
            subscribers: -1,
          },
        },
        context,
      ),
    /channel\.subscribers/,
  );
  assert.throws(
    () =>
      normalizer.normalize(
        {
          ...completeRawChannelData,
          videos: [
            completeRawChannelData.videos[0]!,
            completeRawChannelData.videos[0]!,
          ],
        },
        context,
      ),
    /Duplicate video id/,
  );
  assert.throws(
    () =>
      normalizer.normalize(
        {
          ...completeRawChannelData,
          videos: [
            {
              ...completeRawChannelData.videos[0]!,
              publishedAt: "2027-01-01T00:00:00.000Z",
            },
          ],
        },
        context,
      ),
    /cannot be in the future/,
  );
});
