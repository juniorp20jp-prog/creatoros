import type { YouTubeAnalyticsCapability } from "./models";
import { periodDates, projectChannelAnalytics, projectVideoAnalytics } from "./projection";
import type { YouTubeAnalyticsRepository, YouTubeAnalyticsRepositoryResult } from "./repositories";

type PersistInput = Parameters<YouTubeAnalyticsRepository["persist"]>[0];
const success = <T>(value: T): YouTubeAnalyticsRepositoryResult<T> => ({ status: "success", value: structuredClone(value) });
const missing = <T>(): YouTubeAnalyticsRepositoryResult<T> => ({ status: "failure", error: { code: "not-found", message: "YouTube Analytics data was not found." } });

export class InMemoryYouTubeAnalyticsRepository implements YouTubeAnalyticsRepository {
  private readonly capabilities = new Map<string, YouTubeAnalyticsCapability>();
  private readonly batches = new Map<string, PersistInput>();

  getCapability(userId: string) { return Promise.resolve(this.capabilities.has(userId) ? success(this.capabilities.get(userId)!) : missing<YouTubeAnalyticsCapability>()); }
  saveCapability(value: YouTubeAnalyticsCapability) { this.capabilities.set(value.userId, structuredClone(value)); return Promise.resolve(success(value)); }
  persist(input: PersistInput) {
    if (this.batches.has(input.batch.batchId)) return Promise.resolve({ status: "failure" as const, error: { code: "duplicate" as const, message: "YouTube Analytics batch already exists." } });
    if (hasDuplicateChannelDates(input.channel) || hasDuplicateVideoDates(input.videos)) return Promise.resolve({ status: "failure" as const, error: { code: "duplicate" as const, message: "YouTube Analytics observations contain duplicate dates." } });
    this.batches.set(input.batch.batchId, structuredClone(input));
    return Promise.resolve(success(input.batch));
  }
  getChannelProjection(userId: string, period: Parameters<YouTubeAnalyticsRepository["getChannelProjection"]>[1], asOf: string) {
    const dates = periodDates(period, asOf);
    const batches = [...this.batches.values()].filter((item) => item.batch.userId === userId);
    const rows = mergeNewestRows(batches.flatMap((item) => item.channel.map((row) => ({ row, at: item.batch.collectedAt })))).filter((row) => row.metricDate >= dates.requestedStartDate && row.metricDate <= dates.requestedEndDate);
    const effectiveDataThrough = batches.map((item) => item.batch.effectiveDataThrough).filter((value): value is string => Boolean(value)).sort().at(-1);
    const projection = projectChannelAnalytics({ rows, period, asOf, ...(effectiveDataThrough ? { effectiveDataThrough } : {}) });
    const videos = batches.flatMap((item) => item.videos).filter((row) => row.metricDate >= dates.requestedStartDate && row.metricDate <= dates.requestedEndDate);
    return Promise.resolve(success({ ...projection, videoCount: new Set(videos.map((row) => row.videoId)).size }));
  }
  getVideoProjection(userId: string, period: Parameters<YouTubeAnalyticsRepository["getVideoProjection"]>[1], asOf: string) {
    const dates = periodDates(period, asOf);
    const rows = [...this.batches.values()].filter((item) => item.batch.userId === userId).flatMap((item) => item.videos.map((row) => ({ row, at: item.batch.collectedAt }))).filter((item) => item.row.metricDate >= dates.requestedStartDate && item.row.metricDate <= dates.requestedEndDate);
    return Promise.resolve(success(projectVideoAnalytics(mergeNewestVideoRows(rows))));
  }
}

function mergeNewestRows(items: ReadonlyArray<{ row: PersistInput["channel"][number]; at: string }>): PersistInput["channel"][number][] {
  const byDate = new Map<string, { row: PersistInput["channel"][number]; metricTimes: Map<string, string> }>();
  for (const item of items) {
    const current = byDate.get(item.row.metricDate) ?? { row: { ...item.row, values: {}, availableFields: [] }, metricTimes: new Map<string, string>() };
    const values = { ...current.row.values };
    for (const metric of item.row.availableFields) {
      if (item.row.values[metric] !== undefined && (current.metricTimes.get(metric) ?? "") < item.at) {
        values[metric] = item.row.values[metric];
        current.metricTimes.set(metric, item.at);
      }
    }
    current.row = { ...current.row, batchId: item.row.batchId, values, availableFields: Object.keys(values) as typeof item.row.availableFields };
    byDate.set(item.row.metricDate, current);
  }
  return [...byDate.values()].map((item) => item.row);
}
function mergeNewestVideoRows(items: ReadonlyArray<{ row: PersistInput["videos"][number]; at: string }>): PersistInput["videos"][number][] {
  const byKey = new Map<string, { row: PersistInput["videos"][number]; metricTimes: Map<string, string> }>();
  for (const item of items) {
    const key = item.row.videoId + ":" + item.row.metricDate;
    const current = byKey.get(key) ?? { row: { ...item.row, values: {}, availableFields: [] }, metricTimes: new Map<string, string>() };
    const values = { ...current.row.values };
    for (const metric of item.row.availableFields) {
      if (item.row.values[metric] !== undefined && (current.metricTimes.get(metric) ?? "") < item.at) {
        values[metric] = item.row.values[metric];
        current.metricTimes.set(metric, item.at);
      }
    }
    current.row = { ...current.row, batchId: item.row.batchId, values, availableFields: Object.keys(values) as typeof item.row.availableFields };
    byKey.set(key, current);
  }
  return [...byKey.values()].map((item) => item.row);
}
function hasDuplicateChannelDates(rows: PersistInput["channel"]) { return new Set(rows.map((row) => row.metricDate)).size !== rows.length; }
function hasDuplicateVideoDates(rows: PersistInput["videos"]) { return new Set(rows.map((row) => row.videoId + ":" + row.metricDate)).size !== rows.length; }
