import type { IntelligenceEngine } from "../../interfaces/intelligence-engine";
import { completeExecution, failExecution } from "../../services";
import type {
  EngineDefinition,
  EngineExecutionContext,
  EngineExecutionResult,
} from "../../types";
import { createDataQualityReport } from "./quality";
import { analyzeYouTubeSignals } from "./signals";
import {
  average,
  calculateChannelEngagement,
  calculatePublicationFrequency,
  calculateSubscriberImpact,
  calculateVideoEngagement,
  calculateViewConcentration,
  classifyRelativePerformance,
  median,
} from "./statistics";
import {
  YOUTUBE_INTELLIGENCE_ENGINE_ID,
  type YouTubeIntelligenceEngineId,
  type YouTubeIntelligenceInput,
  type YouTubeIntelligenceOutput,
  type YouTubeMetricName,
  type YouTubeVideoInput,
  type YouTubeVideoPerformance,
} from "./types";
import {
  validateYouTubeIntelligenceInput,
  YouTubeValidationError,
} from "./validation";

const definition = {
  id: YOUTUBE_INTELLIGENCE_ENGINE_ID,
  name: "YouTube Intelligence Engine",
  version: "1.0.0",
  capabilities: [
    "youtube-channel-summary",
    "youtube-video-performance",
    "deterministic-youtube-signals",
    "youtube-data-quality",
  ],
} satisfies EngineDefinition<YouTubeIntelligenceEngineId>;

const OPTIONAL_METRICS = [
  "likes",
  "comments",
  "impressions",
  "ctr",
  "averageViewDurationSeconds",
  "averagePercentageViewed",
  "subscribersGained",
] as const satisfies ReadonlyArray<keyof YouTubeVideoInput>;

function availableMetrics(video: YouTubeVideoInput): ReadonlyArray<YouTubeMetricName> {
  const metrics: Array<YouTubeMetricName> = ["views", "durationSeconds"];

  for (const metric of OPTIONAL_METRICS) {
    if (video[metric] !== undefined) {
      metrics.push(metric);
    }
  }

  return metrics;
}

function createVideoPerformance(
  video: YouTubeVideoInput,
  channelAverageViews: number,
  channelMedianViews: number,
  sampleSize: number,
): YouTubeVideoPerformance {
  const engagement = calculateVideoEngagement(video);

  return {
    videoId: video.id,
    title: video.title,
    publishedAt: video.publishedAt,
    availableMetrics: availableMetrics(video),
    metrics: {
      views: video.views,
      durationSeconds: video.durationSeconds,
      ...(video.likes === undefined ? {} : { likes: video.likes }),
      ...(video.comments === undefined ? {} : { comments: video.comments }),
      ...(video.impressions === undefined
        ? {}
        : { impressions: video.impressions }),
      ...(video.ctr === undefined ? {} : { ctr: video.ctr }),
      ...(video.averageViewDurationSeconds === undefined
        ? {}
        : { averageViewDurationSeconds: video.averageViewDurationSeconds }),
      ...(video.averagePercentageViewed === undefined
        ? {}
        : { averagePercentageViewed: video.averagePercentageViewed }),
      ...(video.subscribersGained === undefined
        ? {}
        : { subscribersGained: video.subscribersGained }),
    },
    derivedMetrics: {
      ...(engagement === undefined ? {} : { engagement }),
      ...(video.subscribersGained === undefined || video.views === 0
        ? {}
        : {
            subscribersGainedPerThousandViews:
              (video.subscribersGained / video.views) * 1000,
          }),
    },
    comparison: {
      channelAverageViews,
      channelMedianViews,
      viewsDifferenceFromMedian: video.views - channelMedianViews,
      ...(channelAverageViews === 0
        ? {}
        : { viewsToAverageRatio: video.views / channelAverageViews }),
      ...(channelMedianViews === 0
        ? {}
        : { viewsToMedianRatio: video.views / channelMedianViews }),
    },
    classification: classifyRelativePerformance(
      video.views,
      channelMedianViews,
      sampleSize,
    ),
  };
}

function coveredPeriod(
  videos: ReadonlyArray<YouTubeVideoInput>,
): { startDate: string; endDate: string } | undefined {
  if (videos.length === 0) {
    return undefined;
  }

  const ordered = [...videos].sort(
    (left, right) => Date.parse(left.publishedAt) - Date.parse(right.publishedAt),
  );
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  return first && last
    ? { startDate: first.publishedAt, endDate: last.publishedAt }
    : undefined;
}

export class YouTubeIntelligenceEngine
  implements
    IntelligenceEngine<
      YouTubeIntelligenceEngineId,
      YouTubeIntelligenceInput,
      YouTubeIntelligenceOutput
    >
{
  readonly definition = definition;

  execute(
    input: YouTubeIntelligenceInput,
    context: EngineExecutionContext,
  ): Promise<EngineExecutionResult<YouTubeIntelligenceOutput>> {
    try {
      const validated = validateYouTubeIntelligenceInput(input);
      const videos = validated.analyzedVideos;
      const views = videos.map((video) => video.views);
      const averageViews = average(views);
      const medianViews = median(views);
      const performances = videos.map((video) =>
        createVideoPerformance(
          video,
          averageViews,
          medianViews,
          videos.length,
        ),
      );
      const signalAnalysis = analyzeYouTubeSignals(videos, performances);
      const output: YouTubeIntelligenceOutput = {
        context: input.context,
        summary: {
          channel: input.channel,
          requestedPeriod: input.context.period,
          ...(coveredPeriod(videos) === undefined
            ? {}
            : { coveredPeriod: coveredPeriod(videos) }),
          analyzedVideoCount: videos.length,
          totalViews: views.reduce((total, value) => total + value, 0),
          averageViews,
          medianViews,
          averageVideoDurationSeconds: average(
            videos.map((video) => video.durationSeconds),
          ),
          publicationFrequency: calculatePublicationFrequency(
            videos.map((video) => video.publishedAt),
          ),
          engagement: calculateChannelEngagement(videos),
          subscriberImpact: calculateSubscriberImpact(videos),
          historicalChannelGrowth: {
            status: "not-calculable",
            reason: "subscriber-history-not-provided",
          },
          viewConcentration: calculateViewConcentration(views),
        },
        videos: performances,
        signals: signalAnalysis.signals,
        dataQuality: createDataQualityReport({
          channel: input.channel,
          inputVideoCount: input.videos.length,
          analyzedVideos: videos,
          excludedVideos: validated.excludedVideos,
          validationWarnings: validated.warnings,
          unevaluatedSignals: signalAnalysis.unevaluatedSignals,
        }),
      };

      return Promise.resolve(completeExecution(context, output));
    } catch (error) {
      return Promise.resolve(
        failExecution(context, {
          code:
            error instanceof YouTubeValidationError
              ? "YOUTUBE_INTELLIGENCE_VALIDATION_FAILED"
              : "YOUTUBE_INTELLIGENCE_EXECUTION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "YouTube Intelligence Engine execution failed.",
          retryable: false,
        }),
      );
    }
  }
}

export const youtubeIntelligenceEngine = new YouTubeIntelligenceEngine();
