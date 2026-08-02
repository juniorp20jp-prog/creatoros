import type { ExternalIdentityAuthenticationService, IdGenerator, SessionService, UserLocale, Clock } from "../../core";
import { AUTH_STATE_COOKIE, type AuthResult } from "./contracts";
import { InMemoryAuthorizationStateStore, safeReturnTo } from "./authorization-state";
import { authorizationStateCookie, clearAuthorizationStateCookie, clearSessionCookie, readCookie, sessionCookie } from "./cookies";
import { CurrentSessionResolver } from "./current-session";
import { reportAuthDiagnostic } from "./diagnostics";
import type { GoogleOidcIdentityAdapter } from "./oidc/google-oidc-adapter";
import { SessionTokenService } from "./session-token";

type AdapterFactory = () => Promise<AuthResult<GoogleOidcIdentityAdapter>>;

export class AuthHttpHandlers {
  constructor(private readonly dependencies: Readonly<{
    adapterFactory: AdapterFactory;
    authorizationStates: InMemoryAuthorizationStateStore;
    externalAuthentication: ExternalIdentityAuthenticationService;
    sessionService: SessionService;
    currentSession: CurrentSessionResolver;
    tokens: SessionTokenService;
    clock: Clock;
    ids: IdGenerator;
    production: boolean;
  }>) {}

  async login(request: Request): Promise<Response> {
    const adapter = await this.dependencies.adapterFactory();
    if (adapter.status === "failure") return authError(adapter.error.code, 503);
    const authorization = await adapter.value.begin();
    const createdAt = this.dependencies.clock.now();
    const expiresAt = new Date(Date.parse(createdAt) + 10 * 60 * 1000).toISOString();
    const handle = this.dependencies.ids.create("authstate");
    this.dependencies.authorizationStates.save(handle, { state: authorization.state, nonce: authorization.nonce, codeVerifier: authorization.codeVerifier, returnTo: safeReturnTo(new URL(request.url).searchParams.get("returnTo")), createdAt, expiresAt });
    return redirect(authorization.authorizationUrl, authorizationStateCookie(handle, this.dependencies.production));
  }

  async callback(request: Request): Promise<Response> {
    const handle = readCookie(request, AUTH_STATE_COOKIE);
    const transaction = handle ? this.dependencies.authorizationStates.consume(handle) : undefined;
    if (!transaction) {
      return this.callbackFailure("authorization-state", "authorization-state-missing", "Authorization state cookie was not available.");
    }
    if (transaction.status === "failure") {
      return this.callbackFailure("authorization-state", transaction.error.code, transaction.error.message);
    }
    const adapter = await this.dependencies.adapterFactory();
    if (adapter.status === "failure") return this.callbackFailure("provider-configuration", adapter.error.code, adapter.error.message);
    const verified = await adapter.value.complete(new URL(request.url), transaction.value);
    if (verified.status === "failure") return this.callbackFailure("oidc-verification", verified.error.code, verified.error.message);
    const token = await this.dependencies.tokens.generate();
    const now = this.dependencies.clock.now();
    const expiresAt = new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1000).toISOString();
    const locale = supportedLocale(verified.value.locale);
    const authenticated = await this.dependencies.externalAuthentication.authenticate({ externalIdentity: verified.value, userId: this.dependencies.ids.create("user"), identityId: this.dependencies.ids.create("identity"), sessionId: this.dependencies.ids.create("session"), tokenHash: token.tokenHash, expiresAt, createdAt: now, locale, metadata: { clientType: "web", locale } });
    if (authenticated.status === "failure") return this.callbackFailure("authentication", authenticated.error.code, authenticated.error.message);
    return new Response(null, { status: 302, headers: [["location", new URL(transaction.value.returnTo, request.url).toString()], ["set-cookie", clearAuthorizationStateCookie(this.dependencies.production)], ["set-cookie", sessionCookie(token.token, this.dependencies.production, 7 * 24 * 60 * 60)]] });
  }

  async session(request: Request): Promise<Response> {
    const result = await this.dependencies.currentSession.resolveCurrentSession(request);
    return Response.json(result.status === "authenticated" ? { data: { authenticated: true, principal: result.principal } } : { data: { authenticated: false, principal: null } }, { status: 200 });
  }

  async logout(request: Request): Promise<Response> {
    const current = await this.dependencies.currentSession.resolveCurrentSession(request);
    if (current.status === "authenticated") await this.dependencies.sessionService.revokeSession(current.principal.sessionId);
    const response = Response.json({ data: { loggedOut: true } });
    response.headers.append("set-cookie", clearSessionCookie(this.dependencies.production));
    return response;
  }

  async protect(request: Request, action: () => Promise<Response>): Promise<Response> {
    const current = await this.dependencies.currentSession.resolveCurrentSession(request);
    return current.status === "authenticated" ? action() : authError("session-invalid", 401);
  }

  private callbackFailure(stage: string, code: string, cause: string): Response {
    reportAuthDiagnostic({ stage, code, cause });
    const response = Response.json({ error: { code: "AUTHENTICATION_FAILED", message: "Authentication could not be completed." } }, { status: 400 });
    response.headers.append("set-cookie", clearAuthorizationStateCookie(this.dependencies.production));
    return response;
  }
}

function supportedLocale(locale: string | undefined): UserLocale {
  if (!locale) return "es";
  const normalized = locale.replace("_", "-");
  if (normalized === "pt-BR") return normalized;
  const language = normalized.split("-")[0];
  return language === "en" || language === "fr" || language === "es" ? language : "es";
}

function authError(code: string, status: number): Response {
  void code;
  return Response.json({ error: { code: "AUTHENTICATION_REQUIRED", message: "A valid CreatorOS session is required." } }, { status });
}

function redirect(location: URL, cookie: string): Response {
  return new Response(null, { status: 302, headers: { location: location.toString(), "set-cookie": cookie } });
}
