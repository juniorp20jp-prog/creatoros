import assert from "node:assert/strict";
import { test } from "node:test";

import { executeYouTubeIntelligence } from "../../../core";
import { youtubeAnalyzerScenarios } from "../fixtures";
import { createYouTubeAnalyzerViewModel } from "../model";

test("View Model maps complete Core output without recalculating values", async () => {
  const result = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.complete,
  );
  const viewModel = createYouTubeAnalyzerViewModel("complete", result);

  assert.equal(result.status, "completed");
  assert.equal(viewModel.state, "success");
  if (result.status === "completed" && viewModel.state === "success") {
    assert.equal(
      viewModel.metrics.find((metric) => metric.id === "averageViews")?.value,
      result.output.summary.averageViews,
    );
    assert.equal(
      viewModel.metrics.find((metric) => metric.id === "medianViews")?.value,
      result.output.summary.medianViews,
    );
    assert.equal(
      viewModel.metrics.find((metric) => metric.id === "engagement")?.value,
      result.output.summary.engagement.rate,
    );
    assert.deepEqual(
      viewModel.signals.map((signal) => signal.code),
      result.output.signals.map((signal) => signal.code),
    );
  }
});

test("View Model preserves exclusions, warnings, and input result immutability", async () => {
  const result = await executeYouTubeIntelligence(
    youtubeAnalyzerScenarios.partial,
  );
  const before = JSON.stringify(result);
  const viewModel = createYouTubeAnalyzerViewModel("partial", result);

  assert.equal(JSON.stringify(result), before);
  assert.equal(viewModel.state, "partial-data");
  if (viewModel.state === "partial-data") {
    assert.deepEqual(viewModel.quality.excludedVideos, [
      {
        videoId: "partial_outside",
        reason: "outside-requested-period",
      },
    ]);
    assert.ok(
      viewModel.quality.warnings.some(
        (warning) => warning.code === "videos-outside-requested-period",
      ),
    );
  }
});
