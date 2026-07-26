import { generateCreatorDecisionsFromYouTubeAnalytics } from "../../decisions";
import {
  YOUTUBE_INTELLIGENCE_ENGINE_ID,
  youtubeIntelligenceEngine,
  type YouTubeIntelligenceOutput,
} from "../../engines";
import { interpretCreatorIntelligence } from "../../intelligence";
import type {
  CreatorAnalysisChannelIdentity,
  CreatorAnalysisRun,
} from "../../persistence";
import type {
  EngineExecutionContext,
  EngineExecutionResult,
} from "../../types";
import {
  completeYouTubeInput,
  minimalYouTubeInput,
} from "./youtube-intelligence-fixtures";

const STARTED_AT = "2026-07-20T12:00:00.000Z";
const FINISHED_AT = "2026-07-20T12:00:01.000Z";
const EXECUTION_ID = "exec_persistence_fixture";

function executionContext(): EngineExecutionContext {
  return {
    executionId: EXECUTION_ID,
    engineId: YOUTUBE_INTELLIGENCE_ENGINE_ID,
    startedAt: STARTED_AT,
    locale: "es",
    correlationId: "correlation_persistence_fixture",
    attributes: { scenario: "complete" },
    now: () => FINISHED_AT,
  };
}

export type AnalysisRunFixtureOptions = {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  locale?: string;
  referenceChannel?: CreatorAnalysisChannelIdentity | null;
};

export async function createCompletedAnalysisRunFixture(
  options: AnalysisRunFixtureOptions = {},
): Promise<CreatorAnalysisRun> {
  const input = structuredClone(completeYouTubeInput);
  const analysis = await youtubeIntelligenceEngine.execute(
    input,
    executionContext(),
  );
  if (analysis.status !== "completed") {
    throw new Error("The deterministic persistence fixture must complete.");
  }

  return {
    id: options.id ?? "analysis_run_complete",
    status: analysis.status,
    createdAt: options.createdAt ?? "2026-07-20T08:00:00-04:00",
    updatedAt: options.updatedAt ?? "2026-07-20T08:05:00-04:00",
    locale: options.locale ?? "es",
    source: {
      platform: "youtube",
      channel: {
        id: input.channel.id,
        name: input.channel.name,
      },
      referenceChannel: options.referenceChannel ?? null,
    },
    snapshots: {
      input,
      analysis,
      intelligence: interpretCreatorIntelligence(analysis),
      decisions: generateCreatorDecisionsFromYouTubeAnalytics(analysis),
    },
    metadata: {
      engineId: analysis.metadata.engineId,
      executionId: analysis.metadata.executionId,
      correlationId: "correlation_persistence_fixture",
      attributes: { scenario: "complete" },
    },
  };
}

export function createFailedAnalysisRunFixture(
  options: AnalysisRunFixtureOptions = {},
): CreatorAnalysisRun {
  const input = structuredClone(minimalYouTubeInput);
  input.channel.subscribers = 0;
  const video = input.videos[0];
  if (video) {
    video.views = 0;
    video.durationSeconds = 0;
  }
  const analysis: EngineExecutionResult<YouTubeIntelligenceOutput> = {
    status: "failed",
    error: {
      code: "YOUTUBE_INTELLIGENCE_EXECUTION_FAILED",
      message: "Deterministic fixture failure.",
      retryable: false,
    },
    metadata: {
      executionId: EXECUTION_ID,
      engineId: YOUTUBE_INTELLIGENCE_ENGINE_ID,
      startedAt: STARTED_AT,
      finishedAt: FINISHED_AT,
      providerIds: [],
      completedStepIds: [],
    },
  };

  return {
    id: options.id ?? "analysis_run_failed",
    status: analysis.status,
    createdAt: options.createdAt ?? STARTED_AT,
    updatedAt: options.updatedAt ?? FINISHED_AT,
    locale: options.locale ?? "pt-BR",
    source: {
      platform: "youtube",
      channel: { id: input.channel.id, name: input.channel.name },
      referenceChannel: options.referenceChannel ?? null,
    },
    snapshots: {
      input,
      analysis,
      intelligence: interpretCreatorIntelligence(analysis),
      decisions: generateCreatorDecisionsFromYouTubeAnalytics(analysis),
    },
    metadata: {
      engineId: analysis.metadata.engineId,
      executionId: analysis.metadata.executionId,
      correlationId: null,
      attributes: {},
    },
  };
}
