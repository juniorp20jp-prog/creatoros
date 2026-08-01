import type {
  AnalysisApiClientError,
  AnalysisDetails,
  AnalysisReadStatus,
} from "../analysis-integration";
import type { Locale } from "../../i18n/config";
import type { MissionControlContent } from "./types";

export function formatMissionControlDate(
  value: string | null,
  locale: Locale,
  unavailable: string,
): string {
  if (value === null) {
    return unavailable;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatMissionControlNumber(
  value: number,
  locale: Locale,
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatAnalysisRunReference(value: string): string {
  const suffixLength = Math.min(8, value.length);
  return `…${value.slice(-suffixLength)}`;
}

export function getPrimaryScore(
  details: AnalysisDetails | null,
): number | null {
  const scores = details?.analysisResult?.scores;
  if (!scores) {
    return null;
  }
  const growth = scores.find(
    (score) =>
      score.kind === "growth" &&
      score.availability === "calculated",
  );
  const calculated =
    growth ??
    scores.find((score) => score.availability === "calculated");
  return calculated?.value ?? null;
}

export function statusLabel(
  status: AnalysisReadStatus,
  content: MissionControlContent,
): string {
  return content.status[status].label;
}

export function safeErrorMessage(
  error: AnalysisApiClientError | null,
  content: MissionControlContent,
): string {
  if (!error) {
    return content.states.loadError;
  }
  switch (error.kind) {
    case "invalid-request":
      return content.errors.invalidRequest;
    case "not-found":
      return content.errors.notFound;
    case "conflict":
      return content.errors.conflict;
    case "unprocessable":
      return content.errors.unprocessable;
    case "network":
      return content.errors.network;
    case "cancelled":
      return content.states.cancelled;
    case "invalid-response":
      return content.errors.invalidResponse;
    case "server":
      return content.errors.server;
  }
}
