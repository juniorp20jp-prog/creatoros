import type { ChannelMetricObservation, MetricObservationBatch, VideoMetricObservation } from "./models";
export function validateMetricObservation(input: Readonly<{ batch: MetricObservationBatch; channel?: ChannelMetricObservation; videos: ReadonlyArray<VideoMetricObservation> }>): boolean {
  if (!input.batch.batchId.trim() || !input.batch.userId.trim() || !input.batch.channelId.trim() || !input.batch.sourceSyncId.trim() || !isIso(input.batch.observedAt) || !isIso(input.batch.createdAt) || input.batch.schemaVersion !== 1 || input.batch.coverageCount < 0 || !Number.isInteger(input.batch.coverageCount) || new Set(input.videos.map((video) => video.videoId)).size !== input.videos.length) return false;
  if (input.channel?.batchId !== undefined && input.channel.batchId !== input.batch.batchId) return false;
  return input.videos.every((video) => video.batchId === input.batch.batchId && video.videoId.trim().length > 0 && [video.viewCount, video.likeCount, video.commentCount].every(validCounter));
}
function isIso(value: string): boolean { const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value; }
function validCounter(value: string | undefined): boolean { return value === undefined || /^(0|[1-9]\d*)$/u.test(value); }
