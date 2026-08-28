import type { Clock } from "../../core";

export type YouTubeAuthorizationTransaction = Readonly<{ userId: string; state: string; nonce: string; codeVerifier: string; returnTo: string; createdAt: string; expiresAt: string }>;
export type YouTubeAuthorizationStateResult =
  | Readonly<{ status: "success"; value: YouTubeAuthorizationTransaction }>
  | Readonly<{ status: "failure"; error: Readonly<{ code: "authorization-state-missing" | "authorization-state-expired" | "authorization-state-consumed"; message: string }> }>;
type Records = Map<string, YouTubeAuthorizationTransaction>;
type ConsumedRecords = Map<string, string>;
type ProcessScope = typeof globalThis & {
  __creatorosYouTubeAuthorizationStateRecords?: Records;
  __creatorosYouTubeConsumedAuthorizationStates?: ConsumedRecords;
};

export class YouTubeAuthorizationStateStore {
  constructor(
    private readonly clock: Clock,
    private readonly records: Records = new Map(),
    private readonly consumedRecords: ConsumedRecords = new Map(),
  ) {}
  save(handle: string, value: YouTubeAuthorizationTransaction): void {
    const normalizedHandle = handle.trim();
    this.consumedRecords.delete(normalizedHandle);
    this.records.set(normalizedHandle, structuredClone(value));
  }
  consume(handle: string): YouTubeAuthorizationTransaction | undefined {
    const result = this.consumeResult(handle);
    return result.status === "success" ? result.value : undefined;
  }
  consumeResult(handle: string): YouTubeAuthorizationStateResult {
    const normalizedHandle = handle.trim();
    const value = this.records.get(normalizedHandle);
    this.records.delete(normalizedHandle);
    if (!value) {
      const consumedUntil = this.consumedRecords.get(normalizedHandle);
      if (consumedUntil && consumedUntil > this.clock.now()) {
        return stateFailure("authorization-state-consumed", "YouTube authorization state was already consumed.");
      }
      this.consumedRecords.delete(normalizedHandle);
      return stateFailure("authorization-state-missing", "YouTube authorization state is missing.");
    }
    if (value.expiresAt <= this.clock.now()) return stateFailure("authorization-state-expired", "YouTube authorization state has expired.");
    this.consumedRecords.set(normalizedHandle, value.expiresAt);
    return { status: "success", value: structuredClone(value) };
  }
}

export function createProcessYouTubeAuthorizationStateStore(clock: Clock): YouTubeAuthorizationStateStore {
  const scope = globalThis as ProcessScope;
  scope.__creatorosYouTubeAuthorizationStateRecords ??= new Map();
  scope.__creatorosYouTubeConsumedAuthorizationStates ??= new Map();
  return new YouTubeAuthorizationStateStore(
    clock,
    scope.__creatorosYouTubeAuthorizationStateRecords,
    scope.__creatorosYouTubeConsumedAuthorizationStates,
  );
}

export function safeYouTubeReturnTo(value: string | null): string {
  return value && /^\/(es|en|fr|pt-BR)\/youtube-analyzer$/u.test(value) ? value : "/es/youtube-analyzer";
}

function stateFailure(code: "authorization-state-missing" | "authorization-state-expired" | "authorization-state-consumed", message: string): YouTubeAuthorizationStateResult {
  return { status: "failure", error: { code, message } };
}
