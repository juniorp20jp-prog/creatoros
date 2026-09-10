import type { ChannelDataNormalizer } from "./contracts";
import type {
  NormalizedChannelData,
  RawChannelData,
  VideoMetrics,
} from "./domain-models";

function requiredText(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return normalized;
}

function optionalText(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function validIsoDate(value: string, field: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${field} must be a valid ISO 8601 timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

function nonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number.`);
  }

  return value;
}

function optionalNonNegative(
  value: number | null | undefined,
  field: string,
): number | undefined {
  return value == null ? undefined : nonNegative(value, field);
}

function normalizeVideos(
  input: RawChannelData,
  analyzedAt: string,
): ReadonlyArray<VideoMetrics> {
  const ids = new Set<string>();
  const analysisTimestamp = Date.parse(analyzedAt);

  return input.videos.map((video, index) => {
    const field = `videos[${index}]`;
    const videoId = requiredText(video.id, `${field}.id`);

    if (ids.has(videoId)) {
      throw new Error(`Duplicate video id: ${videoId}.`);
    }

    ids.add(videoId);
    const publishedAt = validIsoDate(
      video.publishedAt,
      `${field}.publishedAt`,
    );

    if (Date.parse(publishedAt) > analysisTimestamp) {
      throw new Error(`${field}.publishedAt cannot be in the future.`);
    }

    const title = optionalText(video.title);
    return {
      videoId,
      ...(title ? { title } : {}),
      publishedAt,
      views: nonNegative(video.views, `${field}.views`),
      likes: optionalNonNegative(video.likes, `${field}.likes`),
      comments: optionalNonNegative(
        video.comments,
        `${field}.comments`,
      ),
      durationSeconds: optionalNonNegative(
        video.durationSeconds,
        `${field}.durationSeconds`,
      ),
    };
  });
}

export class DefaultChannelDataNormalizer
  implements ChannelDataNormalizer
{
  normalize(
    input: RawChannelData,
    context: { analyzedAt: string },
  ): NormalizedChannelData {
    const collectedAt = validIsoDate(
      input.collectedAt,
      "collectedAt",
    );
    const analyzedAt = validIsoDate(
      context.analyzedAt,
      "analyzedAt",
    );

    if (Date.parse(collectedAt) > Date.parse(analyzedAt)) {
      throw new Error("collectedAt cannot be after analyzedAt.");
    }

    const creatorId = requiredText(input.creator.id, "creator.id");
    const channelCreatorId = requiredText(
      input.channel.creatorId,
      "channel.creatorId",
    );

    if (creatorId !== channelCreatorId) {
      throw new Error(
        "channel.creatorId must match creator.id.",
      );
    }

    return {
      collectedAt,
      creator: {
        id: creatorId,
        displayName: optionalText(input.creator.displayName),
        locale: optionalText(input.creator.locale),
      },
      channel: {
        id: requiredText(input.channel.id, "channel.id"),
        creatorId: channelCreatorId,
        name: optionalText(input.channel.name),
        createdAt:
          input.channel.createdAt == null
            ? undefined
            : validIsoDate(
                input.channel.createdAt,
                "channel.createdAt",
              ),
        language: optionalText(input.channel.language),
        market: optionalText(input.channel.market),
      },
      subscriberCount: nonNegative(
        input.channel.subscribers,
        "channel.subscribers",
      ),
      reportedTotalViews: optionalNonNegative(
        input.channel.totalViews,
        "channel.totalViews",
      ),
      reportedVideoCount: optionalNonNegative(
        input.channel.totalVideos,
        "channel.totalVideos",
      ),
      videos: normalizeVideos(input, analyzedAt),
    };
  }
}
