import type { HistoricalMetricName, MetricTrend } from "./models";
type TrendPoint = Readonly<{ observedAt: string; value?: string; partialCoverage?: boolean }>;
const DAY_MS = 86_400_000;
export class TrendCalculationService {
  calculate(metric: HistoricalMetricName, points: ReadonlyArray<TrendPoint>): MetricTrend {
    const valid = points.filter((point): point is TrendPoint & { value: string } => point.value !== undefined && /^(0|[1-9]\d*)$/u.test(point.value) && Number.isFinite(Date.parse(point.observedAt))).sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
    if (valid.length < 2) return { state: "unavailable", metric, reason: valid.length === 0 ? "unavailable-metric" : "insufficient-history", observationCount: valid.length };
    const first = valid[0]; const last = valid.at(-1);
    if (!first || !last) return { state: "unavailable", metric, reason: "insufficient-history", observationCount: valid.length };
    const elapsedDays = (Date.parse(last.observedAt) - Date.parse(first.observedAt)) / DAY_MS;
    if (!(elapsedDays > 0)) return { state: "unavailable", metric, reason: "invalid-interval", observationCount: valid.length };
    const earliest = BigInt(first.value); const latest = BigInt(last.value); const delta = latest - earliest;
    if (![earliest, latest, delta].every(isSafe)) return { state: "unavailable", metric, reason: "unsafe-number", observationCount: valid.length };
    const acceleration = valid.length >= 3 ? calculateAcceleration(valid) : undefined;
    return { state: "available", metric, earliestValue: first.value, latestValue: last.value, absoluteDelta: delta.toString(), relativeDelta: earliest === 0n ? null : Number(delta) / Number(earliest), velocityPerDay: Number(delta) / elapsedDays, ...(acceleration === undefined ? {} : { accelerationPerDaySquared: acceleration }), observationCount: valid.length, startedAt: first.observedAt, endedAt: last.observedAt, partialCoverage: valid.some((point) => point.partialCoverage === true) };
  }
}
function calculateAcceleration(points: ReadonlyArray<TrendPoint & { value: string }>): number | undefined { const last = points.at(-1); const middle = points.at(-2); const first = points.at(-3); if (!first || !middle || !last) return undefined; const d1 = (Date.parse(middle.observedAt) - Date.parse(first.observedAt)) / DAY_MS; const d2 = (Date.parse(last.observedAt) - Date.parse(middle.observedAt)) / DAY_MS; const span = (Date.parse(last.observedAt) - Date.parse(first.observedAt)) / DAY_MS; const values = [BigInt(first.value), BigInt(middle.value), BigInt(last.value)]; if (!(d1 > 0 && d2 > 0 && span > 0) || !values.every(isSafe)) return undefined; return (((Number(values[2]) - Number(values[1])) / d2) - ((Number(values[1]) - Number(values[0])) / d1)) / span; }
function isSafe(value: bigint): boolean { return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER); }
