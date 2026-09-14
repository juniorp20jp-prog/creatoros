import type { YouTubeAnalyticsCollectionService, YouTubeAnalyticsPeriod } from "../../core";
import type { AuthenticatedPrincipal, CurrentSessionResolver } from "../auth";

export class YouTubeAnalyticsHttpHandlers {
  constructor(private readonly currentSession: CurrentSessionResolver, private readonly serviceFactory: () => Promise<YouTubeAnalyticsCollectionService | undefined>) {}

  status(request: Request): Promise<Response> { return this.withPrincipal(request, async (principal, service) => {
    const result = await service.status(principal.userId);
    if (result.status === "failure") return serviceError(result.error.code);
    const { userId, ...status } = result.value;
    void userId;
    return json({ data: status });
  }); }

  synchronize(request: Request): Promise<Response> { return this.withPrincipal(request, async (principal, service) => {
    const period = readPeriod(new URL(request.url));
    if (!period) return error("INVALID_ANALYTICS_PERIOD", "The Analytics period is invalid.", 400);
    const result = await service.collect(principal.userId, period);
    if (result.status === "failure") return serviceError(result.error.code);
    const { userId, ...collection } = result.value;
    void userId;
    return json({ data: collection });
  }); }

  channel(request: Request): Promise<Response> { return this.withPrincipal(request, async (principal, service) => {
    const period = readPeriod(new URL(request.url));
    if (!period) return error("INVALID_ANALYTICS_PERIOD", "The Analytics period is invalid.", 400);
    const result = await service.channel(principal.userId, period);
    return result.status === "success" ? json({ data: result.value }) : error("YOUTUBE_ANALYTICS_READ_FAILED", "YouTube Analytics could not be loaded.", 500);
  }); }

  videos(request: Request): Promise<Response> { return this.withPrincipal(request, async (principal, service) => {
    const period = readPeriod(new URL(request.url));
    if (!period) return error("INVALID_ANALYTICS_PERIOD", "The Analytics period is invalid.", 400);
    const result = await service.video(principal.userId, period);
    return result.status === "success" ? json({ data: { period, videos: result.value } }) : error("YOUTUBE_ANALYTICS_READ_FAILED", "YouTube Analytics could not be loaded.", 500);
  }); }

  private async withPrincipal(request: Request, action: (principal: AuthenticatedPrincipal, service: YouTubeAnalyticsCollectionService) => Promise<Response>): Promise<Response> {
    const current = await this.currentSession.resolveCurrentSession(request);
    if (current.status !== "authenticated") return error("AUTHENTICATION_REQUIRED", "A valid CreatorOS session is required.", 401);
    const service = await this.serviceFactory();
    return service ? action(current.principal, service) : error("YOUTUBE_ANALYTICS_UNAVAILABLE", "YouTube Analytics is unavailable.", 503);
  }
}

function readPeriod(url: URL): YouTubeAnalyticsPeriod | undefined { const value = url.searchParams.get("period") ?? "30d"; return value === "7d" || value === "30d" || value === "90d" ? value : undefined; }
function serviceError(code: string): Response { if (code === "not-connected") return error("YOUTUBE_NOT_CONNECTED", "YouTube is not connected.", 409); if (code === "not-authorized") return error("YOUTUBE_ANALYTICS_NOT_AUTHORIZED", "YouTube Analytics authorization is required.", 403); if (code === "invalid-period") return error("INVALID_ANALYTICS_PERIOD", "The Analytics period is invalid.", 400); if (code === "collection-in-progress") return error("YOUTUBE_ANALYTICS_COLLECTION_IN_PROGRESS", "A YouTube Analytics collection is already in progress.", 409); if (code === "provider-failure") return error("YOUTUBE_ANALYTICS_PROVIDER_UNAVAILABLE", "YouTube Analytics is temporarily unavailable.", 502); return error("YOUTUBE_ANALYTICS_FAILED", "YouTube Analytics could not be completed.", 500); }
function json(body: unknown, status = 200): Response { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function error(code: string, message: string, status: number): Response { return json({ error: { code, message } }, status); }
