import type { Clock, SessionRepository, UserRepository } from "../../core";
import { AUTH_SESSION_COOKIE, type AuthenticatedPrincipal } from "./contracts";
import { readCookie } from "./cookies";
import { SessionTokenService } from "./session-token";

export type CurrentSessionResult =
  | Readonly<{ status: "authenticated"; principal: AuthenticatedPrincipal }>
  | Readonly<{ status: "anonymous"; reason: "missing" | "invalid" | "expired" | "revoked" | "user-inactive" }>;

const TOUCH_WINDOW_MS = 5 * 60 * 1000;

export class CurrentSessionResolver {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly tokens: SessionTokenService,
    private readonly clock: Clock,
  ) {}

  async resolveCurrentSession(request: Request): Promise<CurrentSessionResult> {
    const token = readCookie(request, AUTH_SESSION_COOKIE);
    if (!token) return { status: "anonymous", reason: "missing" };
    if (!this.tokens.isValidFormat(token)) return { status: "anonymous", reason: "invalid" };
    const session = await this.sessions.getByTokenHash(await this.tokens.hash(token));
    if (session.status === "failure") return { status: "anonymous", reason: "invalid" };
    const now = this.clock.now();
    if (session.value.revokedAt) return { status: "anonymous", reason: "revoked" };
    if (session.value.expiresAt <= now) return { status: "anonymous", reason: "expired" };
    const user = await this.users.getById(session.value.userId);
    if (user.status === "failure" || user.value.status !== "active") return { status: "anonymous", reason: "user-inactive" };
    if (Date.parse(now) - Date.parse(session.value.lastActivityAt) >= TOUCH_WINDOW_MS) {
      await this.sessions.updateLastActivity(session.value.sessionId, now);
    }
    return { status: "authenticated", principal: { userId: user.value.userId, displayName: user.value.displayName, locale: user.value.locale, sessionId: session.value.sessionId, sessionExpiresAt: session.value.expiresAt } };
  }
}
