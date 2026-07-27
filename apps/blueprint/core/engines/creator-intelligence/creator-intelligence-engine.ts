import type { IntelligenceEngine } from "../../interfaces/intelligence-engine";
import { AiPipeline } from "../../pipeline";
import { completeExecution, failExecution } from "../../services";
import type {
  EngineDefinition,
  EngineExecutionContext,
  EngineExecutionResult,
} from "../../types";
import { assertNonEmptyString } from "../../utilities/assertions";
import { CreatorIntelligenceAnalysisPipeline } from "./analysis-pipeline";
import {
  CREATOR_INTELLIGENCE_ENGINE_ID,
  type CreatorIntelligenceEngineId,
  type CreatorIntelligenceInput,
  type CreatorIntelligenceOutput,
  type CreatorIntelligencePipelineState,
} from "./types";

const definition = {
  id: CREATOR_INTELLIGENCE_ENGINE_ID,
  name: "Creator Intelligence Engine",
  version: "0.2.0",
  capabilities: [
    "creator-context",
    "deterministic-channel-analysis",
    "provider-orchestration",
    "recommendation-pipeline",
  ],
} satisfies EngineDefinition<CreatorIntelligenceEngineId>;

export class CreatorIntelligenceEngine
  implements
    IntelligenceEngine<
      CreatorIntelligenceEngineId,
      CreatorIntelligenceInput,
      CreatorIntelligenceOutput
    >
{
  readonly definition = definition;

  constructor(
    private readonly pipeline = new AiPipeline<CreatorIntelligencePipelineState>(
      [],
    ),
    private readonly analysisPipeline =
      new CreatorIntelligenceAnalysisPipeline(),
  ) {}

  async execute(
    input: CreatorIntelligenceInput,
    context: EngineExecutionContext,
  ): Promise<EngineExecutionResult<CreatorIntelligenceOutput>> {
    try {
      this.validateInput(input);

      const pipelineResult = await this.pipeline.run(
        {
          input,
          signals: [],
          recommendations: [],
        },
        context,
      );

      const providerIds = Array.from(
        new Set(input.sources.map((source) => source.providerId)),
      );
      const analysisResult = input.rawChannelData
        ? this.analysisPipeline.run(input.rawChannelData, {
            analysisId: `analysis_${context.executionId}`,
            analyzedAt: context.now(),
          })
        : undefined;
      const completedStepIds = [
        ...pipelineResult.completedStepIds,
        ...(analysisResult?.completedStepIds ?? []),
      ];

      return completeExecution(
        context,
        {
          creator: input.creator,
          objective: input.objective,
          creatorId: input.creator.creatorId,
          readiness:
            analysisResult
              ? "analysis-completed"
              : input.sources.length === 0
              ? "awaiting-sources"
              : "ready-for-providers",
          signals: pipelineResult.state.signals,
          recommendations: pipelineResult.state.recommendations,
          ...(analysisResult
            ? { analysis: analysisResult.analysis }
            : {}),
        },
        {
          providerIds,
          completedStepIds,
        },
      );
    } catch (error) {
      return failExecution(context, {
        code: "CREATOR_INTELLIGENCE_EXECUTION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Creator Intelligence Engine execution failed.",
        retryable: false,
      });
    }
  }

  private validateInput(input: CreatorIntelligenceInput): void {
    assertNonEmptyString(input.creator.creatorId, "creator.creatorId");

    for (const source of input.sources) {
      assertNonEmptyString(source.sourceId, "sources[].sourceId");
      assertNonEmptyString(source.providerId, "sources[].providerId");
    }

    if (
      input.rawChannelData &&
      input.rawChannelData.creator.id.trim() !==
        input.creator.creatorId.trim()
    ) {
      throw new Error(
        "rawChannelData.creator.id must match creator.creatorId.",
      );
    }
  }
}

export const creatorIntelligenceEngine =
  new CreatorIntelligenceEngine();
