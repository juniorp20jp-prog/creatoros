import assert from "node:assert/strict";
import { test } from "node:test";

import {
  validateYouTubeIntelligenceInput,
  YouTubeValidationError,
} from "../engines/youtube-intelligence/validation";
import type { YouTubeIntelligenceInput } from "../engines/youtube-intelligence/types";
import { minimalYouTubeInput } from "./fixtures/youtube-intelligence-fixtures";

function expectValidationCode(
  input: YouTubeIntelligenceInput,
  code: string,
): void {
  assert.throws(
    () => validateYouTubeIntelligenceInput(input),
    (error: unknown) =>
      error instanceof YouTubeValidationError &&
      error.issues.some((issue) => issue.code === code),
  );
}

test("minimal normalized YouTube input is valid", () => {
  const result = validateYouTubeIntelligenceInput(minimalYouTubeInput);

  assert.deepEqual(result.analyzedVideos, minimalYouTubeInput.videos);
  assert.deepEqual(result.excludedVideos, []);
  assert.deepEqual(result.warnings, []);
});

test("duplicate video IDs are validation errors", () => {
  expectValidationCode(
    {
      ...minimalYouTubeInput,
      videos: [minimalYouTubeInput.videos[0]!, minimalYouTubeInput.videos[0]!],
    },
    "duplicate-video-id",
  );
});

test("invalid and impossible ISO dates are rejected", () => {
  expectValidationCode(
    {
      ...minimalYouTubeInput,
      context: { ...minimalYouTubeInput.context, analysisDate: "2026-02-30" },
    },
    "invalid-iso-date",
  );
});

test("future videos are validation errors", () => {
  expectValidationCode(
    {
      ...minimalYouTubeInput,
      videos: [
        {
          ...minimalYouTubeInput.videos[0]!,
          publishedAt: "2026-08-01T00:00:00Z",
        },
      ],
    },
    "future-video",
  );
});

test("negative metrics are validation errors", () => {
  expectValidationCode(
    {
      ...minimalYouTubeInput,
      videos: [{ ...minimalYouTubeInput.videos[0]!, views: -1 }],
    },
    "invalid-non-negative-number",
  );
});

test("CTR and retention percentages outside 0-100 are rejected", () => {
  expectValidationCode(
    {
      ...minimalYouTubeInput,
      videos: [
        {
          ...minimalYouTubeInput.videos[0]!,
          ctr: 101,
          averagePercentageViewed: -1,
        },
      ],
    },
    "percentage-out-of-range",
  );
});

test("valid videos outside the inclusive period are excluded with a warning", () => {
  const outsideVideo = {
    ...minimalYouTubeInput.videos[0]!,
    id: "outside",
    publishedAt: "2025-12-31T23:59:59Z",
  };
  const result = validateYouTubeIntelligenceInput({
    ...minimalYouTubeInput,
    videos: [...minimalYouTubeInput.videos, outsideVideo],
  });

  assert.deepEqual(result.excludedVideos, [
    { videoId: "outside", reason: "outside-requested-period" },
  ]);
  assert.deepEqual(result.warnings[0]?.videoIds, ["outside"]);
  assert.equal(result.analyzedVideos.length, 1);
});
