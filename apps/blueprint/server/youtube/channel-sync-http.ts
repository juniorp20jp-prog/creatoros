import type { AuthenticatedPrincipal, CurrentSessionResolver } from "../auth";
import type { ChannelSynchronizationService } from "../../core";
import {
  toYouTubeChannelReadModel,
  toYouTubeSynchronizationReadModel,
  toYouTubeSynchronizationStatusReadModel,
} from "./http-contracts";

export class ChannelSyncHttpHandlers {
  constructor(private readonly currentSession: CurrentSessionResolver, private readonly serviceFactory: () => Promise<ChannelSynchronizationService | undefined>) {}

  async synchronize(request: Request): Promise<Response> { return this.withPrincipal(request, async (principal) => { const service = await this.serviceFactory(); if (!service) return error("YOUTUBE_SYNC_UNAVAILABLE", "YouTube synchronization is unavailable.", 503); const result = await service.synchronize(principal.userId); if (result.status === "success") return Response.json({ data: { channel: toYouTubeChannelReadModel(result.value.channel), synchronization: toYouTubeSynchronizationReadModel(result.value.synchronization) } }); return syncError(result.error.code); }); }
  async channel(request: Request): Promise<Response> { return this.withPrincipal(request, async (principal) => { const service = await this.serviceFactory(); if (!service) return error("YOUTUBE_SYNC_UNAVAILABLE", "YouTube synchronization is unavailable.", 503); const result = await service.getChannel(principal.userId); return result.status === "success" ? Response.json({ data: result.value ? toYouTubeChannelReadModel(result.value) : null }) : error("YOUTUBE_CHANNEL_FAILED", "YouTube channel could not be loaded.", 500); }); }
  async status(request: Request): Promise<Response> { return this.withPrincipal(request, async (principal) => { const service = await this.serviceFactory(); if (!service) return error("YOUTUBE_SYNC_UNAVAILABLE", "YouTube synchronization is unavailable.", 503); const result = await service.getStatus(principal.userId); return result.status === "success" ? Response.json({ data: toYouTubeSynchronizationStatusReadModel(result.value) }) : error("YOUTUBE_SYNC_STATUS_FAILED", "YouTube synchronization status could not be loaded.", 500); }); }

  private async withPrincipal(request: Request, action: (principal: AuthenticatedPrincipal) => Promise<Response>): Promise<Response> { const current = await this.currentSession.resolveCurrentSession(request); return current.status === "authenticated" ? action(current.principal) : error("AUTHENTICATION_REQUIRED", "A valid CreatorOS session is required.", 401); }
}

function syncError(code: string): Response { if (code === "not-connected") return error("YOUTUBE_NOT_CONNECTED", "YouTube is not connected.", 409); if (code === "channel-not-found") return error("YOUTUBE_CHANNEL_NOT_FOUND", "YouTube channel was not found.", 404); if (code === "channel-private") return error("YOUTUBE_CHANNEL_PRIVATE", "Private YouTube channels cannot be synchronized.", 422); if (code === "quota-exceeded") return error("YOUTUBE_QUOTA_EXCEEDED", "YouTube API quota was exceeded.", 429); if (code === "authorization-failed") return error("YOUTUBE_AUTHORIZATION_EXPIRED", "YouTube authorization must be renewed.", 409); return error("YOUTUBE_SYNC_FAILED", "YouTube channel could not be synchronized.", 502); }
function error(code: string, message: string, status: number): Response { return Response.json({ error: { code, message } }, { status }); }
