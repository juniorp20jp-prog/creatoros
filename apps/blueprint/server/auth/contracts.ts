import type { UserLocale } from "../../core";

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;
export const AUTH_SESSION_COOKIE = "creatoros_session";
export const AUTH_STATE_COOKIE = "creatoros_auth_state";

export type AuthErrorCode = "provider-configuration-error" | "authorization-state-invalid" | "authorization-state-expired" | "callback-error" | "token-exchange-failed" | "identity-claims-invalid" | "email-not-verified" | "identity-not-found" | "identity-conflict" | "user-provisioning-failed" | "session-creation-failed" | "session-invalid" | "session-expired" | "session-revoked" | "persistence-failure";
export type AuthFailure = Readonly<{ status: "failure"; error: Readonly<{ code: AuthErrorCode; message: string }> }>;
export type AuthResult<TValue> = Readonly<{ status: "success"; value: TValue }> | AuthFailure;

export type AuthenticatedPrincipal = Readonly<{
  userId: string;
  displayName: string;
  locale: UserLocale;
  sessionId: string;
  sessionExpiresAt: string;
}>;
