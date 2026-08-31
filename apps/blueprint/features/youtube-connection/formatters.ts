import type { Locale } from "../../i18n/config";

export function formatYouTubeCounter(value: string | undefined, locale: Locale, unavailable: string): string {
  if (value === undefined) return unavailable;
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(value));
  } catch {
    return unavailable;
  }
}

export function formatYouTubeTimestamp(value: string | undefined, locale: Locale, unavailable: string): string {
  if (value === undefined) return unavailable;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return unavailable;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
