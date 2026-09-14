import type {
  ChannelDailyAnalyticsObservation,
  VideoDailyAnalyticsObservation,
  VideoAnalyticsProjection,
  YouTubeAnalyticsBatch,
  YouTubeAnalyticsCapability,
  YouTubeAnalyticsMetric,
  YouTubeAnalyticsPeriod,
  YouTubeAnalyticsProjection,
  YouTubeAnalyticsRepository,
  YouTubeAnalyticsRepositoryResult,
} from "../../youtube-analytics";
import { periodDates, projectChannelAnalytics, projectVideoAnalytics } from "../../youtube-analytics";
import type { AnalysisRunPrismaClient } from "./prisma-client";

const success = <T>(value: T): YouTubeAnalyticsRepositoryResult<T> => ({ status: "success", value });
const failure = <T>(code: "invalid-input" | "not-found" | "duplicate" | "persistence-failure", message: string): YouTubeAnalyticsRepositoryResult<T> => ({ status: "failure", error: { code, message } });

export class PrismaYouTubeAnalyticsRepository implements YouTubeAnalyticsRepository {
  constructor(private readonly client: AnalysisRunPrismaClient) {}

  async getCapability(userId: string): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsCapability>> {
    try {
      const row = await this.client.youTubeAnalyticsCapabilityRow.findUnique({ where: { userId: userId.trim() } });
      return row ? success({ userId: row.userId, state: row.state as YouTubeAnalyticsCapability["state"], ...(row.authorizedAt ? { authorizedAt: row.authorizedAt.toISOString() } : {}), ...(row.lastCollectionAt ? { lastCollectionAt: row.lastCollectionAt.toISOString() } : {}), ...(row.effectiveDataThrough ? { effectiveDataThrough: dateOnly(row.effectiveDataThrough) } : {}), updatedAt: row.updatedAt.toISOString() }) : failure("not-found", "YouTube Analytics capability was not found.");
    } catch { return failure("persistence-failure", "YouTube Analytics capability could not be loaded."); }
  }

  async saveCapability(value: YouTubeAnalyticsCapability): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsCapability>> {
    try {
      const identity = await this.client.youTubeIdentityRow.findUnique({ where: { userId: value.userId } });
      if (!identity) return failure("not-found", "YouTube identity was not found.");
      const data = capabilityData(value, identity.youtubeIdentityId);
      await this.client.youTubeAnalyticsCapabilityRow.upsert({ where: { userId: value.userId }, create: { userId: value.userId, ...data }, update: data });
      return success(value);
    } catch { return failure("persistence-failure", "YouTube Analytics capability could not be saved."); }
  }

  async persist(input: Parameters<YouTubeAnalyticsRepository["persist"]>[0]): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsBatch>> {
    if (hasDuplicateChannelDates(input.channel) || hasDuplicateVideoDates(input.videos)) return failure("duplicate", "YouTube Analytics observations contain duplicate dates.");
    try {
      await this.client.metricObservationBatchRow.create({ data: {
        batchId: input.batch.batchId,
        userId: input.batch.userId,
        channelId: input.batch.channelId,
        sourceSyncId: input.batch.batchId,
        sourceType: "youtube-analytics-query",
        provider: "youtube",
        observedAt: new Date(input.batch.collectedAt),
        collectionOutcome: input.batch.outcome,
        availability: input.batch.outcome === "completed" ? "available" : input.batch.outcome === "partial" ? "partial" : "unavailable",
        coverageCount: input.batch.videoCoverageCount,
        coverageLimit: input.batch.videoCoverageLimit,
        truncated: false,
        schemaVersion: 1,
        provenance: "provider-analytics-query",
        createdAt: new Date(input.batch.collectedAt),
        requestedStartDate: toDate(input.batch.requestedStartDate),
        requestedEndDate: toDate(input.batch.requestedEndDate),
        effectiveDataThrough: input.batch.effectiveDataThrough ? toDate(input.batch.effectiveDataThrough) : null,
        availableFields: [...input.batch.availableFields],
        missingFields: [...input.batch.missingFields],
        ...(input.channel.length ? { channelDailyAnalytics: { create: input.channel.map(channelData) } } : {}),
        ...(input.videos.length ? { videoDailyAnalytics: { create: input.videos.map(videoData) } } : {}),
      } });
      return success(input.batch);
    } catch (error) { return prismaCode(error) === "P2002" ? failure("duplicate", "YouTube Analytics batch already exists.") : failure("persistence-failure", "YouTube Analytics observations could not be saved."); }
  }

  async getChannelProjection(userId: string, period: YouTubeAnalyticsPeriod, asOf: string): Promise<YouTubeAnalyticsRepositoryResult<YouTubeAnalyticsProjection>> {
    try {
      const dates = periodDates(period, asOf);
      const rows = await this.client.channelDailyAnalyticsObservationRow.findMany({ where: { metricDate: { gte: toDate(dates.requestedStartDate), lte: toDate(dates.requestedEndDate) }, batch: { userId: userId.trim(), sourceType: "youtube-analytics-query" } }, include: { batch: true }, orderBy: [{ metricDate: "asc" }, { batch: { observedAt: "desc" } }] });
      const newest = mergeNewestChannel(rows.map((row) => ({ observation: mapChannel(row), collectedAt: row.batch.observedAt.toISOString(), effectiveDataThrough: row.batch.effectiveDataThrough ? dateOnly(row.batch.effectiveDataThrough) : undefined })));
      const effectiveDataThrough = newest.map((item) => item.effectiveDataThrough).filter((value): value is string => Boolean(value)).sort().at(-1);
      const projection = projectChannelAnalytics({ rows: newest.map((item) => item.observation), period, asOf, ...(effectiveDataThrough ? { effectiveDataThrough } : {}) });
      const videoCount = await this.client.videoDailyAnalyticsObservationRow.findMany({ where: { metricDate: { gte: toDate(dates.requestedStartDate), lte: toDate(dates.requestedEndDate) }, batch: { userId: userId.trim(), sourceType: "youtube-analytics-query" } }, distinct: ["videoId"], select: { videoId: true } });
      return success({ ...projection, videoCount: videoCount.length });
    } catch { return failure("persistence-failure", "YouTube channel Analytics could not be loaded."); }
  }

  async getVideoProjection(userId: string, period: YouTubeAnalyticsPeriod, asOf: string): Promise<YouTubeAnalyticsRepositoryResult<ReadonlyArray<VideoAnalyticsProjection>>> {
    try {
      const dates = periodDates(period, asOf);
      const rows = await this.client.videoDailyAnalyticsObservationRow.findMany({ where: { metricDate: { gte: toDate(dates.requestedStartDate), lte: toDate(dates.requestedEndDate) }, batch: { userId: userId.trim(), sourceType: "youtube-analytics-query" } }, include: { batch: true }, orderBy: [{ metricDate: "asc" }, { batch: { observedAt: "desc" } }, { videoId: "asc" }] });
      return success(projectVideoAnalytics(mergeNewestVideo(rows.map((row) => ({ observation: mapVideo(row), collectedAt: row.batch.observedAt.toISOString() })))));
    } catch { return failure("persistence-failure", "YouTube video Analytics could not be loaded."); }
  }
}

function capabilityData(value: YouTubeAnalyticsCapability, youtubeIdentityId: string) { return { youtubeIdentityId, state: value.state, authorizedAt: value.authorizedAt ? new Date(value.authorizedAt) : null, lastCollectionAt: value.lastCollectionAt ? new Date(value.lastCollectionAt) : null, effectiveDataThrough: value.effectiveDataThrough ? toDate(value.effectiveDataThrough) : null, updatedAt: new Date(value.updatedAt) }; }
function channelData(value: ChannelDailyAnalyticsObservation) { return { metricDate: toDate(value.metricDate), ...metricData(value.values), availableFields: [...value.availableFields] }; }
function videoData(value: VideoDailyAnalyticsObservation) { return { videoId: value.videoId, metricDate: toDate(value.metricDate), ...metricData(value.values), availableFields: [...value.availableFields] }; }
function metricData(values: Readonly<Partial<Record<YouTubeAnalyticsMetric, string>>>) { return { views: values.views ?? null, estimatedMinutesWatched: values.estimatedMinutesWatched ?? null, averageViewDuration: values.averageViewDuration ?? null, averageViewPercentage: values.averageViewPercentage ?? null, subscribersGained: values.subscribersGained ?? null, subscribersLost: values.subscribersLost ?? null, likes: values.likes ?? null, comments: values.comments ?? null, shares: values.shares ?? null }; }
function metricValues(row: Record<YouTubeAnalyticsMetric, { toString(): string } | null>) { const values: Partial<Record<YouTubeAnalyticsMetric, string>> = {}; for (const metric of Object.keys(row) as YouTubeAnalyticsMetric[]) if (row[metric] !== null) values[metric] = row[metric]!.toString(); return values; }
function mapChannel(row: Record<YouTubeAnalyticsMetric, { toString(): string } | null> & { batchId: string; metricDate: Date; availableFields: string[] }): ChannelDailyAnalyticsObservation { return { batchId: row.batchId, metricDate: dateOnly(row.metricDate), values: metricValues(row), availableFields: row.availableFields as YouTubeAnalyticsMetric[] }; }
function mapVideo(row: Record<YouTubeAnalyticsMetric, { toString(): string } | null> & { batchId: string; videoId: string; metricDate: Date; availableFields: string[] }): VideoDailyAnalyticsObservation { return { batchId: row.batchId, videoId: row.videoId, metricDate: dateOnly(row.metricDate), values: metricValues(row), availableFields: row.availableFields as YouTubeAnalyticsMetric[] }; }
function mergeNewestChannel<T extends { observation: ChannelDailyAnalyticsObservation; collectedAt: string; effectiveDataThrough?: string }>(rows: ReadonlyArray<T>): T[] {
  const map = new Map<string, T & { metricTimes: Map<string, string> }>();
  for (const item of rows) {
    const current = map.get(item.observation.metricDate) ?? { ...item, observation: { ...item.observation, values: {}, availableFields: [] }, metricTimes: new Map<string, string>() };
    const values = { ...current.observation.values };
    for (const metric of item.observation.availableFields) {
      if (item.observation.values[metric] !== undefined && (current.metricTimes.get(metric) ?? "") < item.collectedAt) {
        values[metric] = item.observation.values[metric];
        current.metricTimes.set(metric, item.collectedAt);
      }
    }
    const effectiveDataThrough = [current.effectiveDataThrough, item.effectiveDataThrough]
      .filter((value): value is string => value !== undefined)
      .sort()
      .at(-1);
    map.set(item.observation.metricDate, { ...current, collectedAt: item.collectedAt > current.collectedAt ? item.collectedAt : current.collectedAt, ...(effectiveDataThrough ? { effectiveDataThrough } : {}), observation: { ...current.observation, batchId: item.observation.batchId, values, availableFields: Object.keys(values) as YouTubeAnalyticsMetric[] } });
  }
  return [...map.values()];
}
function mergeNewestVideo<T extends { observation: VideoDailyAnalyticsObservation; collectedAt: string }>(rows: ReadonlyArray<T>): VideoDailyAnalyticsObservation[] {
  const map = new Map<string, T & { metricTimes: Map<string, string> }>();
  for (const item of rows) {
    const key = item.observation.videoId + ":" + item.observation.metricDate;
    const current = map.get(key) ?? { ...item, observation: { ...item.observation, values: {}, availableFields: [] }, metricTimes: new Map<string, string>() };
    const values = { ...current.observation.values };
    for (const metric of item.observation.availableFields) {
      if (item.observation.values[metric] !== undefined && (current.metricTimes.get(metric) ?? "") < item.collectedAt) {
        values[metric] = item.observation.values[metric];
        current.metricTimes.set(metric, item.collectedAt);
      }
    }
    map.set(key, { ...current, collectedAt: item.collectedAt > current.collectedAt ? item.collectedAt : current.collectedAt, observation: { ...current.observation, batchId: item.observation.batchId, values, availableFields: Object.keys(values) as YouTubeAnalyticsMetric[] } });
  }
  return [...map.values()].map((item) => item.observation);
}
function hasDuplicateChannelDates(rows: ReadonlyArray<ChannelDailyAnalyticsObservation>) { return new Set(rows.map((row) => row.metricDate)).size !== rows.length; }
function hasDuplicateVideoDates(rows: ReadonlyArray<VideoDailyAnalyticsObservation>) { return new Set(rows.map((row) => `${row.videoId}:${row.metricDate}`)).size !== rows.length; }
function toDate(value: string): Date { return new Date(`${value}T00:00:00.000Z`); }
function dateOnly(value: Date): string { return value.toISOString().slice(0, 10); }
function prismaCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }
