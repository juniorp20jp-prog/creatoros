import { AUTH_SESSION_COOKIE, AUTH_STATE_COOKIE } from "./contracts";

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function serialize(name: string, value: string, input: Readonly<{ production: boolean; maxAge: number; path: string }>): string {
  return `${name}=${encodeURIComponent(value)}; Path=${input.path}; HttpOnly; SameSite=Lax; Max-Age=${input.maxAge}${input.production ? "; Secure" : ""}`;
}

export function authorizationStateCookie(handle: string, production: boolean, maxAge = 600): string {
  return serialize(AUTH_STATE_COOKIE, handle, { production, maxAge, path: "/api/auth/google" });
}

export function clearAuthorizationStateCookie(production: boolean): string {
  return serialize(AUTH_STATE_COOKIE, "", { production, maxAge: 0, path: "/api/auth/google" });
}

export function sessionCookie(token: string, production: boolean, maxAge: number): string {
  return serialize(AUTH_SESSION_COOKIE, token, { production, maxAge, path: "/" });
}

export function clearSessionCookie(production: boolean): string {
  return serialize(AUTH_SESSION_COOKIE, "", { production, maxAge: 0, path: "/" });
}
