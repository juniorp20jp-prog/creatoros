import { createAuthDiagnostic, type AuthDiagnostic } from "../auth/diagnostics";

export type YouTubeAuthorizationStage =
  | "authorization-state"
  | "creatoros-session"
  | "configuration"
  | "authorization-callback"
  | "token-exchange"
  | "claims"
  | "channel-lookup"
  | "scopes"
  | "token-encryption"
  | "persistence";

export function createYouTubeDiagnostic(input: Readonly<{
  stage: YouTubeAuthorizationStage;
  code: string;
  cause: string;
  error?: unknown;
}>): AuthDiagnostic {
  return createAuthDiagnostic(input);
}

export function reportYouTubeDiagnostic(input: Parameters<typeof createYouTubeDiagnostic>[0]): void {
  console.error("[CreatorOS YouTube]", JSON.stringify(createYouTubeDiagnostic(input)));
}

export function readSafeYouTubeOAuthCode(error: unknown, fallback: string): string {
  const candidates: unknown[] = [error];
  const safeCodes: string[] = [];
  for (let index = 0; index < candidates.length && index < 12; index += 1) {
    const value = candidates[index];
    if (Array.isArray(value)) {
      candidates.push(...value.slice(0, 4));
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const record = value as Readonly<Record<string, unknown>>;
    for (const key of ["error", "code", "reason"] as const) {
      const candidate = record[key];
      if (typeof candidate === "string" && /^[A-Za-z0-9_.-]{1,80}$/u.test(candidate)) safeCodes.push(candidate);
      else if (typeof candidate === "object" && candidate !== null) candidates.push(candidate);
    }
    for (const key of ["cause", "response", "body", "data", "errors"] as const) {
      const candidate = record[key];
      if (typeof candidate === "object" && candidate !== null) candidates.push(candidate);
    }
  }
  return safeCodes.find((code) => /^[a-z][a-z0-9_]*$/u.test(code)) ?? safeCodes[0] ?? fallback;
}

export function classifyYouTubeTokenExchangeCode(code: string): string {
  return /pkce|code[_-]?verifier/iu.test(code) ? "pkce-failure" : code;
}
