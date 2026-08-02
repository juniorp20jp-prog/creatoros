import type { AuthenticatedPrincipal } from "../auth";
import { readCookie } from "../auth";
import type { CurrentSessionResolver } from "../auth";
import type { Clock, IdGenerator, YouTubeAuthorizationService } from "../../core";
import type { YouTubeOAuthProtocol } from "./openid-client-youtube-protocol";
import { clearYouTubeStateCookie, YOUTUBE_AUTH_STATE_COOKIE, youtubeStateCookie } from "./cookies";
import { safeYouTubeReturnTo, type YouTubeAuthorizationStateStore } from "./authorization-state";

export type YouTubeComposition = Readonly<{ service: YouTubeAuthorizationService; protocol: YouTubeOAuthProtocol }>;
export type YouTubeCompositionResult = Readonly<{ status: "success"; value: YouTubeComposition }> | Readonly<{ status: "failure"; error: Readonly<{ code: string; message: string }> }>;

export class YouTubeHttpHandlers {
  constructor(private readonly dependencies: Readonly<{
    currentSession: CurrentSessionResolver;
    compositionFactory: () => Promise<YouTubeCompositionResult>;
    authorizationStates: YouTubeAuthorizationStateStore;
    clock: Clock;
    ids: IdGenerator;
    production: boolean;
  }>) {}

  async connect(request: Request): Promise<Response> {
    return this.withPrincipal(request, async (principal) => {
      const composition = await this.dependencies.compositionFactory();
      if (composition.status === "failure") return errorResponse("YOUTUBE_UNAVAILABLE", "YouTube authorization is unavailable.", 503);
      const authorization = await composition.value.protocol.begin();
      const createdAt = this.dependencies.clock.now();
      const handle = this.dependencies.ids.create("youtube_state");
      this.dependencies.authorizationStates.save(handle, { userId: principal.userId, state: authorization.state, nonce: authorization.nonce, codeVerifier: authorization.codeVerifier, returnTo: safeYouTubeReturnTo(new URL(request.url).searchParams.get("returnTo")), createdAt, expiresAt: new Date(Date.parse(createdAt) + 10 * 60 * 1000).toISOString() });
      return new Response(null, { status: 302, headers: { location: authorization.authorizationUrl.toString(), "set-cookie": youtubeStateCookie(handle, this.dependencies.production) } });
    });
  }

  async callback(request: Request): Promise<Response> {
    const handle = readCookie(request, YOUTUBE_AUTH_STATE_COOKIE);
    const transaction = handle ? this.dependencies.authorizationStates.consume(handle) : undefined;
    if (!transaction) return callbackError("YOUTUBE_AUTHORIZATION_FAILED", "YouTube authorization could not be completed.", this.dependencies.production, 400);
    const current = await this.dependencies.currentSession.resolveCurrentSession(request);
    if (current.status !== "authenticated" || current.principal.userId !== transaction.userId) return callbackError("AUTHENTICATION_REQUIRED", "A valid CreatorOS session is required.", this.dependencies.production, 401);
    const composition = await this.dependencies.compositionFactory();
    if (composition.status === "failure") return callbackError("YOUTUBE_UNAVAILABLE", "YouTube authorization is unavailable.", this.dependencies.production, 503);
    const verified = await composition.value.protocol.complete(new URL(request.url), transaction);
    if (verified.status === "failure") return callbackError("YOUTUBE_AUTHORIZATION_FAILED", "YouTube authorization could not be completed.", this.dependencies.production, 400);
    const connected = await composition.value.service.connect(current.principal.userId, verified.value);
    if (connected.status === "failure") return callbackError(connected.error.code === "channel-conflict" ? "YOUTUBE_CHANNEL_CONFLICT" : "YOUTUBE_AUTHORIZATION_FAILED", connected.error.code === "channel-conflict" ? "This YouTube channel is already connected." : "YouTube authorization could not be completed.", this.dependencies.production, connected.error.code === "channel-conflict" ? 409 : 500);
    const response = new Response(null, { status: 302, headers: { location: new URL(transaction.returnTo, request.url).toString() } });
    response.headers.append("set-cookie", clearYouTubeStateCookie(this.dependencies.production));
    return response;
  }

  async status(request: Request): Promise<Response> {
    return this.withPrincipal(request, async (principal) => {
      const composition = await this.dependencies.compositionFactory();
      if (composition.status === "failure") return errorResponse("YOUTUBE_UNAVAILABLE", "YouTube authorization is unavailable.", 503);
      const result = await composition.value.service.getStatus(principal.userId);
      return result.status === "success" ? Response.json({ data: result.value }) : errorResponse("YOUTUBE_STATUS_FAILED", "YouTube connection status could not be loaded.", 500);
    });
  }

  async disconnect(request: Request): Promise<Response> {
    return this.withPrincipal(request, async (principal) => {
      const composition = await this.dependencies.compositionFactory();
      if (composition.status === "failure") return errorResponse("YOUTUBE_UNAVAILABLE", "YouTube authorization is unavailable.", 503);
      const result = await composition.value.service.disconnect(principal.userId);
      if (result.status === "success") return Response.json({ data: result.value });
      return errorResponse(result.error.code === "revocation-failed" ? "YOUTUBE_REVOCATION_FAILED" : "YOUTUBE_DISCONNECT_FAILED", "YouTube could not be disconnected safely.", result.error.code === "revocation-failed" ? 502 : 500);
    });
  }

  private async withPrincipal(request: Request, action: (principal: AuthenticatedPrincipal) => Promise<Response>): Promise<Response> {
    const current = await this.dependencies.currentSession.resolveCurrentSession(request);
    return current.status === "authenticated" ? action(current.principal) : errorResponse("AUTHENTICATION_REQUIRED", "A valid CreatorOS session is required.", 401);
  }
}

function callbackError(code: string, message: string, production: boolean, status: number): Response { const response = errorResponse(code, message, status); response.headers.append("set-cookie", clearYouTubeStateCookie(production)); return response; }
function errorResponse(code: string, message: string, status: number): Response { return Response.json({ error: { code, message } }, { status }); }
