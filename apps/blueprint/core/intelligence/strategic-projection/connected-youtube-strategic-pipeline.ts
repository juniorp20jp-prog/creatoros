import {
  CREATOR_DECISION_ENGINE_VERSION,
  generateCreatorDecisionsFromYouTubeAnalytics,
} from "../../decisions";
import {
  CreatorIntelligenceAnalysisPipeline,
  type CreatorAnalysisPipeline,
  type CreatorAnalysisPipelineContext,
  type CreatorAnalysisPipelineResult,
  type RawChannelData,
  type YouTubeIntelligenceInput,
  type YouTubeIntelligenceOutput,
  youtubeIntelligenceEngine,
} from "../../engines";
import type { IntelligenceEngine } from "../../interfaces";
import { CREATOR_INTELLIGENCE_INTERPRETER_VERSION, interpretCreatorIntelligence } from "../creator-intelligence";
import { STRATEGIC_ANALYSIS_PROJECTION_VERSION, type StrategicAnalysisProjection } from "./types";

export const CONNECTED_YOUTUBE_STRATEGIC_PIPELINE_VERSION = "2.0.0" as const;

export const CONNECTED_YOUTUBE_STRATEGIC_PIPELINE_STEPS = [
  "normalization",
  "metrics",
  "scores",
  "opportunities",
  "recommendations",
  "youtube-intelligence",
  "creator-intelligence-interpretation",
  "creator-decision-generation",
  "strategic-projection",
] as const;

export class ConnectedYouTubeStrategicPipeline implements CreatorAnalysisPipeline {
  readonly version = CONNECTED_YOUTUBE_STRATEGIC_PIPELINE_VERSION;

  constructor(
    private readonly foundation: CreatorAnalysisPipeline = new CreatorIntelligenceAnalysisPipeline(),
    private readonly sourceEngine: IntelligenceEngine<"youtube-intelligence", YouTubeIntelligenceInput, YouTubeIntelligenceOutput> = youtubeIntelligenceEngine,
  ) {}

  async run(
    input: RawChannelData,
    context: CreatorAnalysisPipelineContext,
  ): Promise<CreatorAnalysisPipelineResult> {
    const foundation = await this.foundation.run(input, context);
    const sourceInput = this.toSourceInput(input, context);
    const executionId = `${context.analysisId}:youtube-intelligence`;
    const sourceResult = await this.sourceEngine.execute(sourceInput, {
      executionId,
      engineId: "youtube-intelligence",
      startedAt: context.analyzedAt,
      ...(input.creator.locale ? { locale: input.creator.locale } : {}),
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
      attributes: { sourceType: "connected-youtube" },
      now: () => context.analyzedAt,
    });

    if (sourceResult.status === "failed") {
      throw new Error(sourceResult.error.code);
    }

    const creatorIntelligence = interpretCreatorIntelligence(sourceResult);
    const decisions = generateCreatorDecisionsFromYouTubeAnalytics(sourceResult);
    const projection: StrategicAnalysisProjection = {
      schemaVersion: STRATEGIC_ANALYSIS_PROJECTION_VERSION,
      generatedAt: context.analyzedAt,
      provenance: {
        analysisId: context.analysisId,
        sourceType: "connected-youtube",
        ...(context.sourceReference ? { sourceReference: context.sourceReference } : {}),
        capturedAt: input.collectedAt,
      },
      versions: {
        sourceEngine: this.sourceEngine.definition.version,
        creatorInterpreter: CREATOR_INTELLIGENCE_INTERPRETER_VERSION,
        decisionEngine: CREATOR_DECISION_ENGINE_VERSION,
      },
      sourceIntelligence: {
        provider: "youtube",
        engineId: "youtube-intelligence",
        executionId,
        output: sourceResult.output,
      },
      creatorIntelligence,
      decisions,
      dataQuality: sourceResult.output.dataQuality,
      limitations: sourceResult.output.dataQuality.limitations,
    };

    return {
      analysis: { ...foundation.analysis, strategicProjection: projection },
      completedStepIds: CONNECTED_YOUTUBE_STRATEGIC_PIPELINE_STEPS,
    };
  }

  private toSourceInput(
    input: RawChannelData,
    context: CreatorAnalysisPipelineContext,
  ): YouTubeIntelligenceInput {
    const dates = input.videos.map((video) => video.publishedAt).sort();
    const startDate = dates[0] ?? context.analyzedAt;
    const endDate = dates[dates.length - 1] ?? context.analyzedAt;
    return {
      channel: {
        id: input.channel.id,
        name: required(input.channel.name, "channel.name"),
        ...(input.channel.createdAt ? { createdAt: input.channel.createdAt } : {}),
        subscribers: input.channel.subscribers,
        ...(input.channel.totalViews == null ? {} : { totalViews: input.channel.totalViews }),
        ...(input.channel.totalVideos == null ? {} : { totalVideos: input.channel.totalVideos }),
        ...(input.channel.language ?? input.channel.market
          ? { languageOrMarket: input.channel.language ?? input.channel.market ?? undefined }
          : {}),
      },
      videos: input.videos.map((video, index) => ({
        id: video.id,
        title: required(video.title, `videos[${index}].title`),
        publishedAt: video.publishedAt,
        durationSeconds: requiredNumber(video.durationSeconds, `videos[${index}].durationSeconds`),
        views: video.views,
        ...(video.likes == null ? {} : { likes: video.likes }),
        ...(video.comments == null ? {} : { comments: video.comments }),
      })),
      context: {
        analysisDate: context.analyzedAt,
        period: { startDate, endDate },
        ...(input.channel.market ? { market: input.channel.market } : {}),
      },
    };
  }
}

function required(value: string | null | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} is required for connected YouTube intelligence.`);
  return normalized;
}

function requiredNumber(value: number | null | undefined, field: string): number {
  if (value === undefined || value === null || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} is required for connected YouTube intelligence.`);
  }
  return value;
}