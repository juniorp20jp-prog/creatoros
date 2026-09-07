import type { AuthenticatedPrincipal, CurrentSessionResolver } from "../auth";
import type {
  RealYouTubeIntelligenceService,
  VideoSynchronizationService,
} from "../../core";
import {
  toRealYouTubeIntelligenceReadModel,
  toVideoPageReadModel,
  toVideoSynchronizationReadModel,
  toVideoSynchronizationStatusReadModel,
} from "./http-contracts";

type VideoServices = Readonly<{
  synchronization: VideoSynchronizationService;
  intelligence: RealYouTubeIntelligenceService;
}>;

export class VideoSyncHttpHandlers {
  constructor(
    private readonly currentSession: CurrentSessionResolver,
    private readonly servicesFactory: () => Promise<VideoServices | undefined>,
  ) {}

  async synchronize(request: Request): Promise<Response> {
    return this.withPrincipal(request, async (principal, services) => {
      const result = await services.synchronization.synchronize(principal.userId);
      if (result.status === "failure") return syncError(result.error.code);
      return json({
        data: {
          videos: result.value.videos.map(toVideoPageReadModel),
          synchronization: toVideoSynchronizationReadModel(
            result.value.synchronization,
          ),
        },
      });
    });
  }

  async list(request: Request): Promise<Response> {
    return this.withPrincipal(request, async (principal, services) => {
      const url = new URL(request.url);
      const limit = parseLimit(url.searchParams.get("limit"));
      const cursor = decodeCursor(url.searchParams.get("cursor"));
      if (url.searchParams.has("cursor") && !cursor) {
        return error("INVALID_CURSOR", "The video cursor is invalid.", 400);
      }
      const result = await services.synchronization.list(principal.userId, {
        limit,
        ...(cursor ? { cursor } : {}),
      });
      if (result.status === "failure") {
        return result.error.code === "invalid-input"
          ? error("INVALID_CURSOR", "The video cursor is invalid.", 400)
          : error("YOUTUBE_VIDEOS_FAILED", "YouTube videos could not be loaded.", 500);
      }
      return json({
        data: {
          videos: result.value.videos.map(toVideoPageReadModel),
          ...(result.value.nextCursor
            ? { nextCursor: encodeCursor(result.value.nextCursor) }
            : {}),
        },
      });
    });
  }

  async status(request: Request): Promise<Response> {
    return this.withPrincipal(request, async (principal, services) => {
      const result = await services.synchronization.getStatus(principal.userId);
      return result.status === "success"
        ? json({ data: toVideoSynchronizationStatusReadModel(result.value) })
        : error(
            "YOUTUBE_VIDEO_STATUS_FAILED",
            "YouTube video status could not be loaded.",
            500,
          );
    });
  }

  async intelligence(request: Request): Promise<Response> {
    return this.withPrincipal(request, async (principal, services) => {
      const result = await services.intelligence.analyze(principal.userId);
      if (result.status === "failure") {
        if (
          result.error.code === "channel-not-found" ||
          result.error.code === "insufficient-data"
        ) {
          return error("YOUTUBE_INTELLIGENCE_INSUFFICIENT_DATA", "More synchronized YouTube data is required.", 422);
        }
        return error("YOUTUBE_INTELLIGENCE_FAILED", "YouTube intelligence could not be completed.", 500);
      }
      return json({ data: toRealYouTubeIntelligenceReadModel(result.value) });
    });
  }

  private async withPrincipal(
    request: Request,
    action: (
      principal: AuthenticatedPrincipal,
      services: VideoServices,
    ) => Promise<Response>,
  ): Promise<Response> {
    const current = await this.currentSession.resolveCurrentSession(request);
    if (current.status !== "authenticated") {
      return error(
        "AUTHENTICATION_REQUIRED",
        "A valid CreatorOS session is required.",
        401,
      );
    }
    const services = await this.servicesFactory();
    return services
      ? action(current.principal, services)
      : error(
          "YOUTUBE_VIDEO_SYNC_UNAVAILABLE",
          "YouTube video synchronization is unavailable.",
          503,
        );
  }
}

function syncError(code: string): Response {
  if (code === "not-connected") {
    return error("YOUTUBE_NOT_CONNECTED", "YouTube is not connected.", 409);
  }
  if (code === "channel-not-found") {
    return error("YOUTUBE_CHANNEL_NOT_FOUND", "YouTube channel was not found.", 404);
  }
  if (code === "quota-exceeded") {
    return error("YOUTUBE_QUOTA_EXCEEDED", "YouTube API quota was exceeded.", 429);
  }
  if (code === "authorization-failed") {
    return error("YOUTUBE_AUTHORIZATION_EXPIRED", "YouTube authorization must be renewed.", 409);
  }
  return error("YOUTUBE_VIDEO_SYNC_FAILED", "YouTube videos could not be synchronized.", 502);
}
function parseLimit(value: string | null): number {
  if (!value || !/^\d+$/u.test(value)) return 50;
  return Math.min(Math.max(Number(value), 1), 100);
}
function encodeCursor(cursor: Readonly<{ publishedAt: string; videoId: string }>): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
function decodeCursor(
  value: string | null,
): Readonly<{ publishedAt: string; videoId: string }> | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("publishedAt" in parsed) ||
      !("videoId" in parsed) ||
      typeof parsed.publishedAt !== "string" ||
      typeof parsed.videoId !== "string" ||
      Number.isNaN(Date.parse(parsed.publishedAt)) ||
      !parsed.videoId.trim()
    ) return undefined;
    return { publishedAt: parsed.publishedAt, videoId: parsed.videoId };
  } catch {
    return undefined;
  }
}
function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
function error(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}
