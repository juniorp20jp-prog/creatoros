import type { CreateSessionInput, Session } from "./models";

export type SessionRepositoryErrorCode = "invalid-input" | "duplicate-id" | "not-found" | "user-not-found" | "persistence-failure";
export type SessionRepositoryError = Readonly<{ code: SessionRepositoryErrorCode; message: string; sessionId?: string }>;
export type SessionRepositoryResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: SessionRepositoryError }>;

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<SessionRepositoryResult<Session>>;
  getById(sessionId: string): Promise<SessionRepositoryResult<Session>>;
  getByTokenHash(tokenHash: string): Promise<SessionRepositoryResult<Session>>;
  listByUserId(userId: string): Promise<SessionRepositoryResult<ReadonlyArray<Session>>>;
  updateLastActivity(sessionId: string, lastActivityAt: string): Promise<SessionRepositoryResult<Session>>;
  revoke(sessionId: string, revokedAt: string): Promise<SessionRepositoryResult<Session>>;
}
