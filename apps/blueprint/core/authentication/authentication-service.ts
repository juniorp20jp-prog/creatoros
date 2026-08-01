import type { Identity, IdentityRepository, User, UserRepository } from "../identity";
import type { Session, SessionMetadata, SessionService } from "../session";

export type AuthenticationFailureCode = "identity-not-found" | "identity-disabled" | "user-not-found" | "user-inactive" | "session-failure";
export type AuthenticationResult =
  | Readonly<{ status: "authenticated"; user: User; identity: Identity; session: Session }>
  | Readonly<{ status: "failure"; error: Readonly<{ code: AuthenticationFailureCode; message: string }> }>;

export type AuthenticateIdentityInput = Readonly<{
  identityId: string;
  sessionId: string;
  expiresAt: string;
  metadata: SessionMetadata;
}>;

/**
 * Orchestrates an already verified internal identity. Provider verification is
 * intentionally outside this service and can be added later through an adapter.
 */
export class AuthenticationService {
  constructor(
    private readonly users: UserRepository,
    private readonly identities: IdentityRepository,
    private readonly sessions: SessionService,
  ) {}

  async authenticateIdentity(input: AuthenticateIdentityInput): Promise<AuthenticationResult> {
    const identity = await this.identities.getById(input.identityId);
    if (identity.status === "failure") return this.failure("identity-not-found", "Identity could not be authenticated.");
    if (identity.value.status !== "active") return this.failure("identity-disabled", "Identity could not be authenticated.");

    const user = await this.users.getById(identity.value.userId);
    if (user.status === "failure") return this.failure("user-not-found", "Identity could not be authenticated.");
    if (user.value.status !== "active") return this.failure("user-inactive", "Identity could not be authenticated.");

    const session = await this.sessions.createSession({ sessionId: input.sessionId, userId: user.value.userId, expiresAt: input.expiresAt, metadata: input.metadata });
    if (session.status === "failure") return this.failure("session-failure", "Authentication session could not be created.");
    return { status: "authenticated", user: user.value, identity: identity.value, session: session.value };
  }

  private failure(code: AuthenticationFailureCode, message: string): AuthenticationResult {
    return { status: "failure", error: { code, message } };
  }
}
