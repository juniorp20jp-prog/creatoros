import assert from "node:assert/strict";
import { test } from "node:test";

import { executeYouTubeIntelligence } from "../../../core";
import {
  youtubeAnalyzerScenarioIds,
  youtubeAnalyzerScenarios,
} from "../fixtures";
import { createYouTubeAnalyzerViewModel } from "../model";

test("complete fixture executes the real engine and produces success", async () => {
  const result = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.complete,
  );
  const viewModel = createYouTubeAnalyzerViewModel("complete", result);

  assert.equal(result.status, "completed");
  assert.equal(viewModel.state, "success");
  if (viewModel.state === "success") {
    assert.equal(viewModel.channel.id, "demo_complete_channel");
    assert.equal(viewModel.videos.length, 8);
    assert.ok(viewModel.signals.length > 0);
  }
});

test("partial fixture produces partial data without filling missing metrics", async () => {
  const result = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.partial,
  );
  const viewModel = createYouTubeAnalyzerViewModel("partial", result);

  assert.equal(viewModel.state, "partial-data");
  if (viewModel.state === "partial-data") {
    assert.equal(viewModel.videos[0]?.averagePercentageViewed, null);
    assert.equal(viewModel.videos[1]?.ctr, null);
    assert.equal(viewModel.quality.fields.partiallyAvailable.length > 0, true);
    assert.equal(viewModel.quality.warnings.length > 0, true);
  }
});

test("insufficient fixture exposes unevaluated signals", async () => {
  const result = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.insufficient,
  );
  const viewModel = createYouTubeAnalyzerViewModel("insufficient", result);

  assert.equal(viewModel.state, "insufficient-sample");
  if (viewModel.state === "insufficient-sample") {
    assert.equal(viewModel.quality.effectiveVideoCount, 2);
    assert.ok(
      viewModel.quality.unevaluatedSignals.some(
        (signal) => signal.reason === "insufficient-sample",
      ),
    );
  }
});

test("invalid fixture produces a recoverable validation state", async () => {
  const result = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.invalid,
  );
  const viewModel = createYouTubeAnalyzerViewModel("invalid", result);

  assert.equal(result.status, "failed");
  assert.deepEqual(viewModel, {
    state: "validation-error",
    scenarioId: "invalid",
    errorCode: "YOUTUBE_INTELLIGENCE_VALIDATION_FAILED",
  });
});

test("scenario fixtures use stable IDs and deterministic analysis dates", () => {
  assert.deepEqual(youtubeAnalyzerScenarioIds, [
    "complete",
    "partial",
    "insufficient",
    "invalid",
  ]);

  for (const scenarioId of youtubeAnalyzerScenarioIds) {
    const fixture = youtubeAnalyzerScenarios[scenarioId];
    assert.equal(fixture.context.analysisDate, "2026-07-20T12:00:00Z");
    assert.equal(new Set(fixture.videos.map((video) => video.id)).size > 0, true);
  }
});

test("scenario execution and View Model output are deterministic", async () => {
  const firstResult = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.complete,
  );
  const secondResult = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.complete,
  );

  assert.deepEqual(
    createYouTubeAnalyzerViewModel("complete", firstResult),
    createYouTubeAnalyzerViewModel("complete", secondResult),
  );
});
