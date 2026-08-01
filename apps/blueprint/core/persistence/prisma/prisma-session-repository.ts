import type { CreateSessionInput, Session, SessionRepository, SessionRepositoryError, SessionRepositoryResult } from "../../session";
import { createSession, isCanonicalTimestamp } from "../../session";
import type { AnalysisRunPrismaClient } from "./prisma-client";
import { mapSessionRow } from "./authentication-row-mappers";

function success<TValue>(value: TValue): SessionRepositoryResult<TValue> { return { status: "success", value }; }
function failure<TValue>(error: SessionRepositoryError): SessionRepositoryResult<TValue> { return { status: "failure", error }; }
function errorCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly client: AnalysisRunPrismaClient) {}

  async create(input: CreateSessionInput): Promise<SessionRepositoryResult<Session>> {
    const validated = createSession(input);
    if (validated.status === "failure") return validated;
    const value = validated.value;
    try {
      const row = await this.client.sessionRow.create({ data: { sessionId: value.sessionId, userId: value.userId, createdAt: new Date(value.createdAt), expiresAt: new Date(value.expiresAt), lastActivityAt: new Date(value.lastActivityAt), metadata: { ...value.metadata } } });
      return this.map(row, value.sessionId);
    } catch (error) {
      if (errorCode(error) === "P2002") return failure({ code: "duplicate-id", message: "Session already exists.", sessionId: value.sessionId });
      if (errorCode(error) === "P2003") return failure({ code: "user-not-found", message: "Session user was not found.", sessionId: value.sessionId });
      return failure({ code: "persistence-failure", message: "Session persistence failed.", sessionId: value.sessionId });
    }
  }

  async getById(sessionId: string): Promise<SessionRepositoryResult<Session>> {
    try {
      const row = await this.client.sessionRow.findUnique({ where: { sessionId: sessionId.trim() } });
      return row ? this.map(row, sessionId) : this.notFound(sessionId);
    } catch { return failure({ code: "persistence-failure", message: "Session persistence failed.", sessionId }); }
  }

  async listByUserId(userId: string): Promise<SessionRepositoryResult<ReadonlyArray<Session>>> {
    try {
      const rows = await this.client.sessionRow.findMany({ where: { userId: userId.trim() }, orderBy: [{ createdAt: "desc" }, { sessionId: "asc" }] });
      const sessions: Session[] = [];
      for (const row of rows) {
        const mapped = mapSessionRow(row);
        if (!mapped) return failure({ code: "persistence-failure", message: "Stored session data is invalid." });
        sessions.push(mapped);
      }
      return success(sessions);
    } catch { return failure({ code: "persistence-failure", message: "Session persistence failed." }); }
  }

  async updateLastActivity(sessionId: string, lastActivityAt: string): Promise<SessionRepositoryResult<Session>> {
    const current = await this.getById(sessionId);
    if (current.status === "failure") return current;
    if (!isCanonicalTimestamp(lastActivityAt) || lastActivityAt < current.value.lastActivityAt || lastActivityAt >= current.value.expiresAt) return failure({ code: "invalid-input", message: "Session activity timestamp is invalid.", sessionId });
    try {
      const row = await this.client.sessionRow.update({ where: { sessionId }, data: { lastActivityAt: new Date(lastActivityAt) } });
      return this.map(row, sessionId);
    } catch (error) { return errorCode(error) === "P2025" ? this.notFound(sessionId) : failure({ code: "persistence-failure", message: "Session persistence failed.", sessionId }); }
  }

  async revoke(sessionId: string, revokedAt: string): Promise<SessionRepositoryResult<Session>> {
    const current = await this.getById(sessionId);
    if (current.status === "failure") return current;
    if (!isCanonicalTimestamp(revokedAt) || revokedAt < current.value.createdAt) return failure({ code: "invalid-input", message: "Session revocation timestamp is invalid.", sessionId });
    if (current.value.revokedAt) return current;
    try {
      const row = await this.client.sessionRow.update({ where: { sessionId }, data: { revokedAt: new Date(revokedAt) } });
      return this.map(row, sessionId);
    } catch (error) { return errorCode(error) === "P2025" ? this.notFound(sessionId) : failure({ code: "persistence-failure", message: "Session persistence failed.", sessionId }); }
  }

  private map(row: Parameters<typeof mapSessionRow>[0], sessionId: string): SessionRepositoryResult<Session> {
    const value = mapSessionRow(row);
    return value ? success(value) : failure({ code: "persistence-failure", message: "Stored session data is invalid.", sessionId });
  }
  private notFound(sessionId: string): SessionRepositoryResult<never> { return failure({ code: "not-found", message: "Session was not found.", sessionId }); }
}
