import type {
  DecisionEvidence,
  DecisionMessage,
  DecisionMetric,
} from "../../core";
import type { Locale } from "../../i18n/config";
import type { CreatorDecisionDictionary } from "./types";

function lookup(content: unknown, key: string): string | null {
  let value = content;
  const normalizedKey = key.startsWith("creatorDecisions.")
    ? key.slice("creatorDecisions.".length)
    : key;
  for (const segment of normalizedKey.split(".")) {
    if (value === null || typeof value !== "object") {
      return null;
    }
    value = (value as Readonly<Record<string, unknown>>)[segment];
  }
  return typeof value === "string" ? value : null;
}

function interpolate(
  template: string,
  parameters: Readonly<Record<string, string | number>>,
): string {
  return template.replace(
    /\{([A-Za-z0-9]+)\}/g,
    (placeholder, name: string) => {
      const replacement = parameters[name];
      return replacement === undefined ? placeholder : String(replacement);
    },
  );
}

export function resolveDecisionMessage(
  content: CreatorDecisionDictionary,
  message: DecisionMessage,
): string {
  return interpolate(
    lookup(content, message.messageKey) ?? message.defaultMessage,
    message.parameters,
  );
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

export function formatDecisionEvidenceValue(
  evidence: DecisionEvidence,
  locale: Locale,
): string {
  if (typeof evidence.value === "string") {
    return evidence.value;
  }
  if (evidence.sourceRef.endsWith("maximumMedianRatio")) {
    return `${formatNumber(evidence.value, locale)}×`;
  }
  if (evidence.unit === "ratio") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(evidence.value);
  }
  if (evidence.unit === "percentage-points") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(evidence.value)}%`;
  }
  if (evidence.unit === "days") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "day",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(evidence.value);
  }
  if (evidence.unit === "seconds") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "second",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(evidence.value);
  }
  return formatNumber(evidence.value, locale);
}

export function formatDecisionDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatDecisionPeriod(
  period: { startDate: string; endDate: string },
  locale: Locale,
): string {
  return `${formatDecisionDate(period.startDate, locale)} – ${formatDecisionDate(period.endDate, locale)}`;
}

export function formatDecisionMetricBaseline(
  metric: DecisionMetric,
  locale: Locale,
  unavailable: string,
): string {
  if (metric.baseline === null) {
    return unavailable;
  }
  if (metric.unit === "percentage-points") {
    return `${formatNumber(metric.baseline, locale)}%`;
  }
  return formatNumber(metric.baseline, locale);
}

