import type { Clock } from "../services";
import type { Session, SessionMetadata } from "./models";
import type { SessionRepository, SessionRepositoryResult } from "./session-repository";

export type SessionState = "active" | "expired" | "revoked";
export type SessionServiceErrorCode = "invalid-input" | "not-found" | "persistence-failure";
export type SessionServiceResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: Readonly<{ code: SessionServiceErrorCode; message: string }> }>;
export type ResolvedSession = Readonly<{ session: Session; state: SessionState }>;

export class SessionService {
  constructor(private readonly repository: SessionRepository, private readonly clock: Clock) {}

  async createSession(input: Readonly<{ sessionId: string; userId: string; expiresAt: string; metadata: SessionMetadata }>): Promise<SessionServiceResult<Session>> {
    return this.map(await this.repository.create({ ...input, createdAt: this.clock.now() }));
  }

  async getSession(sessionId: string): Promise<SessionServiceResult<ResolvedSession>> {
    const result = await this.repository.getById(sessionId);
    if (result.status === "failure") return this.mapFailure(result.error.code);
    const now = this.clock.now();
    const state: SessionState = result.value.revokedAt ? "revoked" : result.value.expiresAt <= now ? "expired" : "active";
    return { status: "success", value: { session: result.value, state } };
  }

  async touchSession(sessionId: string): Promise<SessionServiceResult<Session>> {
    return this.map(await this.repository.updateLastActivity(sessionId, this.clock.now()));
  }

  async revokeSession(sessionId: string): Promise<SessionServiceResult<Session>> {
    return this.map(await this.repository.revoke(sessionId, this.clock.now()));
  }

  private map<TValue>(result: SessionRepositoryResult<TValue>): SessionServiceResult<TValue> {
    if (result.status === "success") return { status: "success", value: result.value };
    return this.mapFailure(result.error.code);
  }

  private mapFailure(code: "invalid-input" | "duplicate-id" | "not-found" | "user-not-found" | "persistence-failure"): SessionServiceResult<never> {
    if (code === "not-found") return { status: "failure", error: { code, message: "Session was not found." } };
    if (code === "persistence-failure") return { status: "failure", error: { code, message: "Session persistence failed." } };
    return { status: "failure", error: { code: "invalid-input", message: "Session input is invalid." } };
  }
}
