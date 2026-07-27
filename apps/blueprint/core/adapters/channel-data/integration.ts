import {
  CreatorIntelligenceAnalysisPipeline,
  type AnalysisResult,
  type CreatorAnalysisPipelineContext,
} from "../../engines/creator-intelligence";
import type {
  ChannelDataAdapter,
  ChannelDataAdapterFailure,
  ChannelDataAdapterPartial,
  ChannelDataAdapterSuccess,
} from "./contracts";

type AdaptedChannelData = ChannelDataAdapterSuccess |
  ChannelDataAdapterPartial;

export type ChannelDataAnalysisIntegrationResult =
  | {
      status: "completed";
      adapterResult: AdaptedChannelData;
      analysis: AnalysisResult;
      completedStepIds: ReadonlyArray<string>;
    }
  | {
      status: "failed";
      stage: "adapter";
      adapterResult: ChannelDataAdapterFailure;
    }
  | {
      status: "failed";
      stage: "pipeline";
      adapterResult: AdaptedChannelData;
      error: {
        code: "CHANNEL_DATA_PIPELINE_FAILED";
        message: string;
      };
    };

export function executeAdaptedChannelAnalysis<TSource>(
  source: TSource,
  adapter: ChannelDataAdapter<TSource>,
  context: CreatorAnalysisPipelineContext,
  pipeline = new CreatorIntelligenceAnalysisPipeline(),
): ChannelDataAnalysisIntegrationResult {
  const adapterResult = adapter.adapt(source);

  if (adapterResult.status === "failure") {
    return {
      status: "failed",
      stage: "adapter",
      adapterResult,
    };
  }

  try {
    const pipelineResult = pipeline.run(
      adapterResult.rawChannelData,
      context,
    );

    return {
      status: "completed",
      adapterResult,
      analysis: pipelineResult.analysis,
      completedStepIds: pipelineResult.completedStepIds,
    };
  } catch (error) {
    return {
      status: "failed",
      stage: "pipeline",
      adapterResult,
      error: {
        code: "CHANNEL_DATA_PIPELINE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Channel data pipeline execution failed.",
      },
    };
  }
}
