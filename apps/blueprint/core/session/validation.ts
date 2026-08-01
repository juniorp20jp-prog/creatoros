import type { CreateSessionInput, Session } from "./models";
import type { SessionRepositoryError, SessionRepositoryResult } from "./session-repository";

function failure<TValue>(message: string, sessionId?: string): SessionRepositoryResult<TValue> {
  const error: SessionRepositoryError = { code: "invalid-input", message, ...(sessionId ? { sessionId } : {}) };
  return { status: "failure", error };
}

export function isCanonicalTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}

export function createSession(input: CreateSessionInput): SessionRepositoryResult<Session> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) return failure("Session identifier is required.");
  const userId = input.userId.trim();
  if (!userId) return failure("Session user identifier is required.", sessionId);
  if (!isCanonicalTimestamp(input.createdAt) || !isCanonicalTimestamp(input.expiresAt)) return failure("Session timestamps must be canonical ISO-8601.", sessionId);
  if (input.expiresAt <= input.createdAt) return failure("Session expiration must be after creation.", sessionId);
  return {
    status: "success",
    value: {
      sessionId,
      userId,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      lastActivityAt: input.createdAt,
      metadata: structuredClone(input.metadata),
    },
  };
}
