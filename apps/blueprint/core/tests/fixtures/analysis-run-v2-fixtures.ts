import type {
  ChannelDataAdapterMetadata,
} from "../../adapters";
import {
  CreatorIntelligenceAnalysisPipeline,
  type AnalysisResult,
} from "../../engines";
import type {
  CreateAnalysisRunInput,
} from "../../persistence";
import type { Clock } from "../../services";
import { completeRawChannelData } from "./creator-intelligence-analysis-fixtures";

export class TestClock implements Clock {
  private index = 0;

  constructor(
    private readonly values: ReadonlyArray<string> = [
      "2026-07-20T13:00:00.000Z",
    ],
  ) {}

  now(): string {
    const value =
      this.values[this.index] ??
      this.values[this.values.length - 1];
    this.index += 1;

    if (!value) {
      throw new Error("TestClock requires a timestamp.");
    }

    return value;
  }
}

export const baseAnalysisRunInput: CreateAnalysisRunInput = {
  schemaVersion: 2,
  analysisRunId: "analysis_run_test",
  creatorId: "creator_test",
  channelId: "channel_test",
  source: {
    sourceType: "local-fixture",
    sourceSchemaVersion: "1",
  },
  pipelineVersion: "1.0.0",
  correlationId: "correlation_test",
};

export const fixtureAdapterMetadata: ChannelDataAdapterMetadata = {
  adapterId: "fixture-channel-data",
  adapterVersion: "1.0.0",
  sourceType: "local-fixture",
  supportedSchemaVersion: "1",
  processedAt: "2026-07-20T13:00:00.000Z",
};

export function createAnalysisResultFixture(): AnalysisResult {
  return new CreatorIntelligenceAnalysisPipeline().run(
    completeRawChannelData,
    {
      analysisId: "analysis_analysis_run_test",
      analyzedAt: "2026-07-20T13:00:00.000Z",
    },
  ).analysis;
}
