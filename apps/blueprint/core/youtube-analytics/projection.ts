import { YOUTUBE_ANALYTICS_METRICS, type ChannelDailyAnalyticsObservation, type VideoAnalyticsProjection, type VideoDailyAnalyticsObservation, type YouTubeAnalyticsMetric, type YouTubeAnalyticsPeriod, type YouTubeAnalyticsProjection, type YouTubeAnalyticsValues } from "./models";

export function periodDates(period: YouTubeAnalyticsPeriod, asOf: string) {
  const days = Number(period.slice(0, -1));
  const end = new Date(asOf);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { requestedStartDate: start.toISOString().slice(0, 10), requestedEndDate: end.toISOString().slice(0, 10) };
}

export function projectChannelAnalytics(input: Readonly<{ rows: ReadonlyArray<ChannelDailyAnalyticsObservation>; period: YouTubeAnalyticsPeriod; asOf: string; effectiveDataThrough?: string }>): YouTubeAnalyticsProjection {
  const dates = periodDates(input.period, input.asOf);
  const values = aggregate(input.rows);
  const availableFields = Object.keys(values) as Array<YouTubeAnalyticsMetric>;
  const netSubscribers = subtract(values.subscribersGained, values.subscribersLost);
  const effectiveDataThrough = input.effectiveDataThrough ?? newestDate(input.rows);
  return {
    period: input.period,
    ...dates,
    ...(effectiveDataThrough ? { effectiveDataThrough } : {}),
    availability: input.rows.length === 0 ? "no-data" : availableFields.length === YOUTUBE_ANALYTICS_METRICS.length ? "available" : "partial",
    freshness: !effectiveDataThrough ? "unavailable" : effectiveDataThrough < dates.requestedEndDate ? "processing" : "current",
    values: { ...values, ...(netSubscribers === undefined ? {} : { netSubscribers }) },
    availableFields: [...availableFields, ...(netSubscribers === undefined ? [] : ["netSubscribers" as const])],
    missingFields: YOUTUBE_ANALYTICS_METRICS.filter((metric) => !availableFields.includes(metric)),
    channelDays: new Set(input.rows.map((row) => row.metricDate)).size,
    videoCount: 0,
  };
}

export function projectVideoAnalytics(rows: ReadonlyArray<VideoDailyAnalyticsObservation>): ReadonlyArray<VideoAnalyticsProjection> {
  const grouped = new Map<string, Array<VideoDailyAnalyticsObservation>>();
  for (const row of rows) grouped.set(row.videoId, [...(grouped.get(row.videoId) ?? []), row]);
  return [...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([videoId, items]) => {
    const values = aggregate(items);
    const availableFields = Object.keys(values) as Array<YouTubeAnalyticsMetric>;
    const netSubscribers = subtract(values.subscribersGained, values.subscribersLost);
    return { videoId, values: { ...values, ...(netSubscribers === undefined ? {} : { netSubscribers }) }, availableFields: [...availableFields, ...(netSubscribers === undefined ? [] : ["netSubscribers" as const])], observedDays: new Set(items.map((item) => item.metricDate)).size };
  });
}

function aggregate(rows: ReadonlyArray<{ values: YouTubeAnalyticsValues }>): YouTubeAnalyticsValues {
  const result: Partial<Record<YouTubeAnalyticsMetric, string>> = {};
  for (const metric of YOUTUBE_ANALYTICS_METRICS) {
    const values = rows.flatMap((row) => {
      const value = row.values[metric];
      const parsed = value === undefined ? undefined : parseDecimal(value);
      return parsed ? [parsed] : [];
    });
    if (values.length === 0) continue;
    const total = addDecimals(values);
    result[metric] =
      metric === "averageViewDuration" || metric === "averageViewPercentage"
        ? divideDecimal(total, values.length)
        : formatDecimal(total);
  }
  return result;
}
type Decimal = Readonly<{ coefficient: bigint; scale: number }>;
function parseDecimal(value: string): Decimal | undefined {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/u.exec(value);
  if (!match) return undefined;
  const fraction = match[3] ?? "";
  const sign = match[1] === "-" ? -1n : 1n;
  return { coefficient: sign * BigInt((match[2] ?? "0") + fraction), scale: fraction.length };
}
function addDecimals(values: ReadonlyArray<Decimal>): Decimal {
  const scale = Math.max(...values.map((value) => value.scale));
  return {
    coefficient: values.reduce(
      (sum, value) => sum + value.coefficient * 10n ** BigInt(scale - value.scale),
      0n,
    ),
    scale,
  };
}
function divideDecimal(value: Decimal, divisor: number): string {
  const precision = 6;
  const scaled = value.coefficient * 10n ** BigInt(precision);
  const divisorBigInt = BigInt(divisor);
  let quotient = scaled / divisorBigInt;
  const remainder = scaled % divisorBigInt;
  if ((remainder < 0n ? -remainder : remainder) * 2n >= divisorBigInt) {
    quotient += scaled < 0n ? -1n : 1n;
  }
  return formatDecimal({ coefficient: quotient, scale: value.scale + precision });
}
function formatDecimal(value: Decimal): string {
  const negative = value.coefficient < 0n;
  const digits = (negative ? -value.coefficient : value.coefficient)
    .toString()
    .padStart(value.scale + 1, "0");
  const integer = value.scale === 0 ? digits : digits.slice(0, -value.scale);
  const fraction = value.scale === 0 ? "" : digits.slice(-value.scale).replace(/0+$/u, "");
  const normalized = fraction ? integer + "." + fraction : integer;
  return negative && normalized !== "0" ? "-" + normalized : normalized;
}
function subtract(left?: string, right?: string): string | undefined {
  if (left === undefined || right === undefined) return undefined;
  const leftDecimal = parseDecimal(left);
  const rightDecimal = parseDecimal(right);
  if (!leftDecimal || !rightDecimal) return undefined;
  return formatDecimal(addDecimals([leftDecimal, { ...rightDecimal, coefficient: -rightDecimal.coefficient }]));
}
function newestDate(rows: ReadonlyArray<{ metricDate: string }>): string | undefined { return rows.map((row) => row.metricDate).sort().at(-1); }
