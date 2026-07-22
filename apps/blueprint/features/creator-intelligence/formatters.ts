import type { EvidenceUnit, IntelligenceMessageParameters } from "../../core";
import type { Locale } from "../../i18n/config";

export function resolveIntelligenceMessage(
  content: unknown,
  key: string,
  parameters: IntelligenceMessageParameters = {},
): string {
  let value: unknown = content;
  for (const segment of key.split(".")) {
    if (value === null || typeof value !== "object") {
      return key;
    }
    value = (value as Readonly<Record<string, unknown>>)[segment];
  }

  if (typeof value !== "string") {
    return key;
  }

  return value.replace(/\{([A-Za-z0-9]+)\}/g, (placeholder, name: string) => {
    const replacement = parameters[name];
    return replacement === undefined ? placeholder : String(replacement);
  });
}

export function formatIntelligenceValue(
  value: number,
  unit: EvidenceUnit,
  locale: Locale,
): string {
  if (unit === "ratio") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (unit === "percentage-points") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
  }
  if (unit === "seconds") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "second",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (unit === "days") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "day",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: unit === "count" ? 0 : 2,
  }).format(value);
}

export function formatIntelligenceDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
