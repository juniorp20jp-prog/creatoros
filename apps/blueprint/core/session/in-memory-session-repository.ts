import type { UserRepository } from "../identity";
import type { CreateSessionInput, Session } from "./models";
import { type SessionRepository, type SessionRepositoryError, type SessionRepositoryResult } from "./session-repository";
import { createSession, isCanonicalTimestamp } from "./validation";

function success<TValue>(value: TValue): SessionRepositoryResult<TValue> {
  return { status: "success", value: structuredClone(value) };
}
function failure<TValue>(error: SessionRepositoryError): SessionRepositoryResult<TValue> {
  return { status: "failure", error };
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();
  constructor(private readonly users: UserRepository) {}

  async create(input: CreateSessionInput): Promise<SessionRepositoryResult<Session>> {
    const result = createSession(input);
    if (result.status === "failure") return result;
    if (this.sessions.has(result.value.sessionId)) return failure({ code: "duplicate-id", message: "Session identifier already exists.", sessionId: result.value.sessionId });
    const user = await this.users.getById(result.value.userId);
    if (user.status === "failure") return failure({ code: "user-not-found", message: "Session user was not found.", sessionId: result.value.sessionId });
    this.sessions.set(result.value.sessionId, structuredClone(result.value));
    return success(result.value);
  }

  async getById(sessionId: string): Promise<SessionRepositoryResult<Session>> {
    const value = this.sessions.get(sessionId.trim());
    return value ? success(value) : failure({ code: "not-found", message: "Session was not found.", sessionId });
  }

  async listByUserId(userId: string): Promise<SessionRepositoryResult<ReadonlyArray<Session>>> {
    return success([...this.sessions.values()].filter((session) => session.userId === userId.trim()).sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  async updateLastActivity(sessionId: string, lastActivityAt: string): Promise<SessionRepositoryResult<Session>> {
    const current = this.sessions.get(sessionId.trim());
    if (!current) return failure({ code: "not-found", message: "Session was not found.", sessionId });
    if (!isCanonicalTimestamp(lastActivityAt) || lastActivityAt < current.lastActivityAt || lastActivityAt >= current.expiresAt) return failure({ code: "invalid-input", message: "Session activity timestamp is invalid.", sessionId });
    const updated = { ...current, lastActivityAt };
    this.sessions.set(current.sessionId, updated);
    return success(updated);
  }

  async revoke(sessionId: string, revokedAt: string): Promise<SessionRepositoryResult<Session>> {
    const current = this.sessions.get(sessionId.trim());
    if (!current) return failure({ code: "not-found", message: "Session was not found.", sessionId });
    if (!isCanonicalTimestamp(revokedAt) || revokedAt < current.createdAt) return failure({ code: "invalid-input", message: "Session revocation timestamp is invalid.", sessionId });
    const updated = current.revokedAt ? current : { ...current, revokedAt };
    this.sessions.set(current.sessionId, updated);
    return success(updated);
  }
}
