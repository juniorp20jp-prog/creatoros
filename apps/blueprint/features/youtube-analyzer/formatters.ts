import type { Locale } from "../../i18n/config";
import type { AnalyzerValueFormat } from "./model";

export function formatAnalyzerValue(
  value: number | null,
  format: AnalyzerValueFormat,
  locale: Locale,
  notAvailable: string,
): string {
  if (value === null) {
    return notAvailable;
  }

  if (format === "percentage-ratio") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (format === "percentage-points") {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    }).format(value)}%`;
  }

  if (format === "seconds") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "second",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (format === "days") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "day",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: format === "integer" ? 0 : 1,
  }).format(value);
}

export function formatAnalyzerDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
