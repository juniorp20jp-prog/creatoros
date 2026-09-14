import type {
  YouTubeAnalyticsAdapter,
  YouTubeAnalyticsMetric,
  YouTubeAnalyticsProviderRequest,
  YouTubeAnalyticsProviderResult,
} from "../../core";
import { YOUTUBE_ANALYTICS_METRICS } from "../../core";

const ENDPOINT = "https://youtubeanalytics.googleapis.com/v2/reports";
const METRICS = YOUTUBE_ANALYTICS_METRICS.join(",");

type Report = Readonly<{ columnHeaders: ReadonlyArray<Readonly<{ name: string }>>; rows?: ReadonlyArray<ReadonlyArray<unknown>> }>;
type QueryResult = Readonly<{ status: "success"; value: Report }> | Readonly<{ status: "failure"; error: Readonly<{ code: "authorization" | "quota" | "unavailable" | "invalid-response"; message: string }> }>;
type ParsedRow = { metricDate: string; videoId?: string; values: Partial<Record<YouTubeAnalyticsMetric, string>>; availableFields: YouTubeAnalyticsMetric[] };
type ParsedResult = Readonly<{ status: "success"; value: Readonly<{ rows: ReadonlyArray<ParsedRow>; availableFields: ReadonlyArray<YouTubeAnalyticsMetric>; filteredUnknownVideoCount: number }> }> | Readonly<{ status: "failure"; error: Readonly<{ code: "invalid-response"; message: string }> }>;

export class GoogleYouTubeAnalyticsApiAdapter implements YouTubeAnalyticsAdapter {
  constructor(private readonly request: typeof globalThis.fetch = globalThis.fetch.bind(globalThis)) {}

  async collect(input: YouTubeAnalyticsProviderRequest): Promise<YouTubeAnalyticsProviderResult> {
    const channel = await this.query(input, "day");
    if (channel.status === "failure") return channel;
    const video = input.videoIds.length > 0 ? await this.query(input, "day,video", input.videoIds) : { status: "success" as const, value: { columnHeaders: [], rows: [] } };
    if (video.status === "failure") return video;
    const channelRows = parseChannelReport(channel.value);
    const videoRows = parseVideoReport(video.value, new Set(input.videoIds));
    if (channelRows.status === "failure" || videoRows.status === "failure") return providerFailure("invalid-response", "YouTube Analytics returned an invalid report.");
    const availableFields = [...new Set([...channelRows.value.availableFields, ...videoRows.value.availableFields])].sort() as YouTubeAnalyticsMetric[];
    const missingFields = YOUTUBE_ANALYTICS_METRICS.filter((metric) => !availableFields.includes(metric));
    const effectiveDataThrough = [...channelRows.value.rows.map((row) => row.metricDate), ...videoRows.value.rows.map((row) => row.metricDate)].sort().at(-1);
    return { status: "success", value: { channel: channelRows.value.rows, videos: videoRows.value.rows, availableFields, missingFields, ...(effectiveDataThrough ? { effectiveDataThrough } : {}), partial: missingFields.length > 0 || videoRows.value.filteredUnknownVideoCount > 0 } };
  }

  private async query(input: YouTubeAnalyticsProviderRequest, dimensions: "day" | "day,video", videoIds?: ReadonlyArray<string>): Promise<QueryResult> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("ids", "channel==MINE");
    url.searchParams.set("startDate", input.startDate);
    url.searchParams.set("endDate", input.endDate);
    url.searchParams.set("metrics", METRICS);
    url.searchParams.set("dimensions", dimensions);
    if (videoIds?.length) url.searchParams.set("filters", `video==${videoIds.slice(0, 50).join(",")}`);
    try {
      const response = await this.request(url, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${input.accessToken}` }, cache: "no-store" });
      if (!response.ok) {
        const category = await providerErrorCategory(response);
        return queryFailure(category, "YouTube Analytics is temporarily unavailable.");
      }
      const body: unknown = await response.json();
      return isReport(body) ? { status: "success", value: body } : queryFailure("invalid-response", "YouTube Analytics returned an invalid report.");
    } catch { return queryFailure("unavailable", "YouTube Analytics is temporarily unavailable."); }
  }
}

export function parseChannelReport(report: Report) {
  const result = parseReport(report, false, new Set());
  return result.status === "failure" ? result : { status: "success" as const, value: { ...result.value, rows: result.value.rows.map((row) => ({ metricDate: row.metricDate, values: row.values, availableFields: row.availableFields })) } };
}
export function parseVideoReport(report: Report, allowedVideoIds: ReadonlySet<string>) {
  const result = parseReport(report, true, allowedVideoIds);
  return result.status === "failure" ? result : { status: "success" as const, value: { ...result.value, rows: result.value.rows.map((row) => ({ videoId: row.videoId!, metricDate: row.metricDate, values: row.values, availableFields: row.availableFields })) } };
}

function parseReport(report: Report, requiresVideo: boolean, allowedVideoIds: ReadonlySet<string>): ParsedResult {
  const headers = report.columnHeaders.map((header) => header.name);
  if (new Set(headers).size !== headers.length || !headers.includes("day") || (requiresVideo && !headers.includes("video"))) return parseFailure();
  const rows: ParsedRow[] = [];
  let filteredUnknownVideoCount = 0;
  for (const raw of report.rows ?? []) {
    if (raw.length !== headers.length) return parseFailure();
    const value = Object.fromEntries(headers.map((header, index) => [header, raw[index]]));
    if (typeof value.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value.day)) return parseFailure();
    if (requiresVideo && (typeof value.video !== "string" || !value.video.trim())) return parseFailure();
    if (requiresVideo && !allowedVideoIds.has(String(value.video))) { filteredUnknownVideoCount += 1; continue; }
    const values: Partial<Record<YouTubeAnalyticsMetric, string>> = {};
    for (const metric of YOUTUBE_ANALYTICS_METRICS) {
      if (!(metric in value) || value[metric] === null) continue;
      const normalized = numeric(value[metric]);
      if (normalized === undefined) return parseFailure();
      values[metric] = normalized;
    }
    const availableFields = Object.keys(values) as YouTubeAnalyticsMetric[];
    rows.push({ metricDate: value.day, ...(requiresVideo ? { videoId: String(value.video) } : {}), values, availableFields });
  }
  return { status: "success", value: { rows, availableFields: YOUTUBE_ANALYTICS_METRICS.filter((metric) => headers.includes(metric)), filteredUnknownVideoCount } };
}

function numeric(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isFinite(value) && (Number.isInteger(value) ? Number.isSafeInteger(value) : true) ? String(value) : undefined;
  return typeof value === "string" && /^-?\d+(?:\.\d+)?$/u.test(value) ? value : undefined;
}
function isReport(value: unknown): value is Report { return typeof value === "object" && value !== null && "columnHeaders" in value && Array.isArray(value.columnHeaders) && value.columnHeaders.every((header) => typeof header === "object" && header !== null && "name" in header && typeof header.name === "string") && (!("rows" in value) || value.rows === undefined || Array.isArray(value.rows)); }
function providerFailure(code: "authorization" | "quota" | "unavailable" | "invalid-response", message: string): YouTubeAnalyticsProviderResult { return { status: "failure", error: { code, message } }; }
function queryFailure(code: "authorization" | "quota" | "unavailable" | "invalid-response", message: string): QueryResult { return { status: "failure", error: { code, message } }; }
function parseFailure() { return { status: "failure" as const, error: { code: "invalid-response" as const, message: "YouTube Analytics returned an invalid report." } }; }
async function providerErrorCategory(response: Response): Promise<"authorization" | "quota" | "unavailable"> {
  if (response.status === 401) return "authorization";
  if (response.status === 429) return "quota";
  let body: unknown;
  try { body = await response.json(); } catch { return response.status === 403 ? "authorization" : "unavailable"; }
  const reason = safeProviderReason(body);
  if (["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded"].includes(reason ?? "")) return "quota";
  if (["authError", "forbidden", "insufficientPermissions", "insufficient_scope"].includes(reason ?? "")) return "authorization";
  return response.status === 403 ? "authorization" : "unavailable";
}
function safeProviderReason(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const error = isRecord(value.error) ? value.error : undefined;
  const errors = error && Array.isArray(error.errors) ? error.errors : [];
  const reason = errors.find(isRecord)?.reason;
  return typeof reason === "string" ? reason : typeof error?.status === "string" ? error.status : undefined;
}
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return typeof value === "object" && value !== null && !Array.isArray(value); }
