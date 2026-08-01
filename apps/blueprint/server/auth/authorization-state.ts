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

export class InMemoryAuthorizationStateStore {
  private readonly records = new Map<string, AuthorizationTransaction>();
  constructor(private readonly clock: Clock) {}

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

export function safeReturnTo(value: string | null): string {
  if (!value) return "/es/mission-control";
  return /^\/(es|en|fr|pt-BR)\/mission-control$/.test(value) ? value : "/es/mission-control";
}

function failure(code: "authorization-state-invalid" | "authorization-state-expired", message: string): AuthResult<never> {
  return { status: "failure", error: { code, message } };
}
