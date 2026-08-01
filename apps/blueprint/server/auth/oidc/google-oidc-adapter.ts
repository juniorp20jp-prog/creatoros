import type { Clock } from "../../../core";
import type { VerifiedExternalIdentity } from "../../../core/authentication";
import { GOOGLE_ISSUERS, type AuthResult } from "../contracts";

export type GoogleAuthorizationRequest = Readonly<{ authorizationUrl: URL; state: string; nonce: string; codeVerifier: string }>;
export type GoogleCallbackChecks = Readonly<{ state: string; nonce: string; codeVerifier: string }>;

export interface GoogleOidcProtocol {
  createAuthorizationRequest(redirectUri: string): Promise<GoogleAuthorizationRequest>;
  exchangeCallback(callbackUrl: URL, checks: GoogleCallbackChecks): Promise<Readonly<Record<string, unknown>>>;
}

export class GoogleOidcIdentityAdapter {
  constructor(private readonly protocol: GoogleOidcProtocol, private readonly clientId: string, private readonly redirectUri: string, private readonly clock: Clock) {}

  begin(): Promise<GoogleAuthorizationRequest> {
    return this.protocol.createAuthorizationRequest(this.redirectUri);
  }

  async complete(callbackUrl: URL, checks: GoogleCallbackChecks): Promise<AuthResult<VerifiedExternalIdentity>> {
    if (callbackUrl.searchParams.has("error")) return failure("callback-error", "The identity provider rejected the authentication request.");
    if (callbackUrl.searchParams.get("state") !== checks.state) return failure("authorization-state-invalid", "Authorization state is invalid.");
    let claims: Readonly<Record<string, unknown>>;
    try { claims = await this.protocol.exchangeCallback(callbackUrl, checks); } catch { return failure("token-exchange-failed", "The identity provider callback could not be verified."); }
    if (!GOOGLE_ISSUERS.includes(claims.iss as (typeof GOOGLE_ISSUERS)[number])) return failure("identity-claims-invalid", "Identity claims are invalid.");
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(this.clientId) || claims.nonce !== checks.nonce || typeof claims.exp !== "number" || claims.exp * 1000 <= Date.parse(this.clock.now())) return failure("identity-claims-invalid", "Identity claims are invalid.");
    if (typeof claims.sub !== "string" || !claims.sub.trim() || typeof claims.email !== "string" || !claims.email.trim()) return failure("identity-claims-invalid", "Identity claims are invalid.");
    if (claims.email_verified !== true) return failure("email-not-verified", "The Google email address is not verified.");
    return { status: "success", value: { provider: "google", providerSubject: claims.sub, email: claims.email.trim().toLowerCase(), emailVerified: true, ...(typeof claims.name === "string" && claims.name.trim() ? { displayName: claims.name.trim() } : {}), ...(typeof claims.locale === "string" ? { locale: claims.locale } : {}) } };
  }
}

function failure(code: "callback-error" | "authorization-state-invalid" | "token-exchange-failed" | "identity-claims-invalid" | "email-not-verified", message: string): AuthResult<never> {
  return { status: "failure", error: { code, message } };
}
