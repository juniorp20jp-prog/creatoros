import type { Clock } from "../../core";
import type { AuthResult } from "./contracts";

export type AuthorizationTransaction = Readonly<{
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: string;
  expiresAt: string;
}>;

type AuthorizationStateRecords = Map<string, AuthorizationTransaction>;

type CreatorOSProcess = typeof globalThis & {
  __creatorosAuthorizationStateRecords?: AuthorizationStateRecords;
};

export class InMemoryAuthorizationStateStore {
  constructor(
    private readonly clock: Clock,
    private readonly records: AuthorizationStateRecords = new Map(),
  ) {}

  save(handle: string, transaction: AuthorizationTransaction): void {
    this.records.set(handle, structuredClone(transaction));
  }

  consume(handle: string): AuthResult<AuthorizationTransaction> {
    const value = this.records.get(handle);
    this.records.delete(handle);
    if (!value) return failure("authorization-state-invalid", "Authorization state is invalid or was already consumed.");
    if (value.expiresAt <= this.clock.now()) return failure("authorization-state-expired", "Authorization state has expired.");
    return { status: "success", value: structuredClone(value) };
  }
}

/** Shares transient OIDC state between independently bundled Node.js routes. */
export function createProcessAuthorizationStateStore(clock: Clock): InMemoryAuthorizationStateStore {
  const processScope = globalThis as CreatorOSProcess;
  processScope.__creatorosAuthorizationStateRecords ??= new Map();
  return new InMemoryAuthorizationStateStore(clock, processScope.__creatorosAuthorizationStateRecords);
}

export function safeReturnTo(value: string | null): string {
  if (!value) return "/es/mission-control";
  return /^\/(es|en|fr|pt-BR)\/mission-control$/.test(value) ? value : "/es/mission-control";
}

function failure(code: "authorization-state-invalid" | "authorization-state-expired", message: string): AuthResult<never> {
  return { status: "failure", error: { code, message } };
}
