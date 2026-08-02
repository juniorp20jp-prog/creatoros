import type { Clock } from "../../core";

export type YouTubeAuthorizationTransaction = Readonly<{ userId: string; state: string; nonce: string; codeVerifier: string; returnTo: string; createdAt: string; expiresAt: string }>;
type Records = Map<string, YouTubeAuthorizationTransaction>;
type ProcessScope = typeof globalThis & { __creatorosYouTubeAuthorizationStateRecords?: Records };

export class YouTubeAuthorizationStateStore {
  constructor(private readonly clock: Clock, private readonly records: Records = new Map()) {}
  save(handle: string, value: YouTubeAuthorizationTransaction): void { this.records.set(handle, structuredClone(value)); }
  consume(handle: string): YouTubeAuthorizationTransaction | undefined {
    const value = this.records.get(handle.trim());
    this.records.delete(handle.trim());
    return value && value.expiresAt > this.clock.now() ? structuredClone(value) : undefined;
  }
}

export function createProcessYouTubeAuthorizationStateStore(clock: Clock): YouTubeAuthorizationStateStore {
  const scope = globalThis as ProcessScope;
  scope.__creatorosYouTubeAuthorizationStateRecords ??= new Map();
  return new YouTubeAuthorizationStateStore(clock, scope.__creatorosYouTubeAuthorizationStateRecords);
}

export function safeYouTubeReturnTo(value: string | null): string {
  return value && /^\/(es|en|fr|pt-BR)\/youtube-analyzer$/u.test(value) ? value : "/es/youtube-analyzer";
}
