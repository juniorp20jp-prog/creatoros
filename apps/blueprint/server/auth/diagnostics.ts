export type AuthDiagnostic = Readonly<{
  name: string;
  code: string;
  stage: string;
  cause: string;
  stack: string | null;
}>;

export function createAuthDiagnostic(input: Readonly<{
  stage: string;
  code: string;
  cause: string;
  error?: unknown;
}>): AuthDiagnostic {
  const error = input.error;
  return {
    name: error instanceof Error ? error.name : "AuthFailureResult",
    code: input.code,
    stage: input.stage,
    cause: input.cause,
    stack: error instanceof Error ? redactStack(error) : null,
  };
}

export function reportAuthDiagnostic(input: Parameters<typeof createAuthDiagnostic>[0]): void {
  console.error("[CreatorOS auth]", JSON.stringify(createAuthDiagnostic(input)));
}

export function readSafeExternalErrorCode(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;
  const record = error as Readonly<Record<string, unknown>>;
  for (const key of ["error", "code"] as const) {
    const value = record[key];
    if (typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/u.test(value)) return value;
  }
  return fallback;
}

function redactStack(error: Error): string {
  const frames = (error.stack ?? "")
    .split(/\r?\n/u)
    .slice(1)
    .filter((line) => /^\s*at\s/u.test(line));
  return [`${error.name}: [redacted]`, ...frames].join("\n");
}
