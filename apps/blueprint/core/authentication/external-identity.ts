import type { Identity, User, UserLocale } from "../identity";
import type { SessionMetadata } from "../session";
import type { AuthenticationService } from "./authentication-service";

export type VerifiedExternalIdentity = Readonly<{
  provider: "google";
  providerSubject: string;
  email: string;
  emailVerified: true;
  displayName?: string;
  locale?: string;
}>;

export type IdentityProvisioningErrorCode = "identity-conflict" | "user-provisioning-failed" | "persistence-failure";
export type IdentityProvisioningResult =
  | Readonly<{ status: "success"; user: User; identity: Identity; provisioned: boolean }>
  | Readonly<{ status: "failure"; error: Readonly<{ code: IdentityProvisioningErrorCode; message: string }> }>;

export interface ExternalIdentityProvisioner {
  resolveOrProvision(input: Readonly<{
    externalIdentity: VerifiedExternalIdentity;
    userId: string;
    identityId: string;
    locale: UserLocale;
    createdAt: string;
  }>): Promise<IdentityProvisioningResult>;
}

export type ExternalAuthenticationResult =
  | Readonly<{ status: "authenticated"; user: User; identity: Identity; sessionId: string; expiresAt: string; provisioned: boolean }>
  | Readonly<{ status: "failure"; error: Readonly<{ code: IdentityProvisioningErrorCode | "identity-disabled" | "user-inactive" | "session-creation-failed"; message: string }> }>;

export class ExternalIdentityAuthenticationService {
  constructor(
    private readonly provisioner: ExternalIdentityProvisioner,
    private readonly authentication: AuthenticationService,
  ) {}

  async authenticate(input: Readonly<{
    externalIdentity: VerifiedExternalIdentity;
    userId: string;
    identityId: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: string;
    createdAt: string;
    locale: UserLocale;
    metadata: SessionMetadata;
  }>): Promise<ExternalAuthenticationResult> {
    const resolved = await this.provisioner.resolveOrProvision(input);
    if (resolved.status === "failure") return resolved;
    const authenticated = await this.authentication.authenticateIdentity({
      identityId: resolved.identity.identityId,
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    });
    if (authenticated.status === "failure") {
      const code = authenticated.error.code === "identity-disabled" ? "identity-disabled" : authenticated.error.code === "user-inactive" ? "user-inactive" : "session-creation-failed";
      return { status: "failure", error: { code, message: "External identity authentication failed." } };
    }
    return { status: "authenticated", user: authenticated.user, identity: authenticated.identity, sessionId: authenticated.session.sessionId, expiresAt: authenticated.session.expiresAt, provisioned: resolved.provisioned };
  }
}
