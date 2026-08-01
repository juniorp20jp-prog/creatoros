import { Buffer } from "node:buffer";

import type {
  AnalysisQueryCursorPayload,
  AnalysisQueryFilters,
} from "./contracts";

export function analysisFilterSignature(
  filters: AnalysisQueryFilters,
): string {
  return JSON.stringify({
    channelId: filters.channelId,
    status: filters.status ?? null,
    creatorId: filters.creatorId ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    attempt: filters.attempt ?? null,
    analysisId: filters.analysisId ?? null,
  });
}

export function encodeAnalysisQueryCursor(
  payload: AnalysisQueryCursorPayload,
): string {
  return Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");
}

export function decodeAnalysisQueryCursor(
  cursor: string,
): AnalysisQueryCursorPayload | undefined {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("repositoryCursor" in parsed) ||
      typeof parsed.repositoryCursor !== "string" ||
      parsed.repositoryCursor.trim().length === 0 ||
      !("filterSignature" in parsed) ||
      typeof parsed.filterSignature !== "string"
    ) {
      return undefined;
    }
    return {
      version: 1,
      repositoryCursor: parsed.repositoryCursor,
      filterSignature: parsed.filterSignature,
    };
  } catch {
    return undefined;
  }
}
