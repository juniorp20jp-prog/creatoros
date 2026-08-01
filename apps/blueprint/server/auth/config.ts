import type { AuthResult } from "./contracts";

export type AuthConfiguration = Readonly<{
  googleClientId: string;
  googleClientSecret?: string;
  googleRedirectUri: string;
  appBaseUrl: string;
  cookieSecret: string;
  production: boolean;
}>;

export function readAuthConfiguration(environment: Readonly<Record<string, string | undefined>> = process.env): AuthResult<AuthConfiguration> {
  const googleClientId = environment.GOOGLE_CLIENT_ID?.trim();
  const appBaseUrl = validUrl(environment.APP_BASE_URL);
  const googleRedirectUri = validUrl(environment.GOOGLE_REDIRECT_URI);
  const cookieSecret = environment.AUTH_COOKIE_SECRET?.trim();
  const production = environment.NODE_ENV === "production";
  if (!googleClientId || !appBaseUrl || !googleRedirectUri || !cookieSecret || cookieSecret.length < 32) {
    return failure();
  }
  if (new URL(appBaseUrl).origin !== new URL(googleRedirectUri).origin || new URL(googleRedirectUri).pathname !== "/api/auth/google/callback") return failure();
  if (production && (new URL(appBaseUrl).protocol !== "https:" || new URL(googleRedirectUri).protocol !== "https:")) return failure();
  return {
    status: "success",
    value: {
      googleClientId,
      ...(environment.GOOGLE_CLIENT_SECRET?.trim() ? { googleClientSecret: environment.GOOGLE_CLIENT_SECRET.trim() } : {}),
      googleRedirectUri,
      appBaseUrl,
      cookieSecret,
      production,
    },
  };
}

function validUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}

function failure(): AuthResult<never> {
  return { status: "failure", error: { code: "provider-configuration-error", message: "Authentication provider configuration is invalid." } };
}
