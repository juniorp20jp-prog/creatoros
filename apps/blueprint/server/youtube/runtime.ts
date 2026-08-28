import { SessionTokenService, CurrentSessionResolver } from "../auth";
import { ChannelSynchronizationService, SystemClock, UuidGenerator, YouTubeAuthorizationService } from "../../core";
import { createAnalysisRunPrismaClient, PrismaChannelSynchronizationRepository, PrismaSessionRepository, PrismaUserRepository, PrismaYouTubeAuthorizationRepository, requireDatabaseUrl } from "../../core/persistence/prisma";
import { AesGcmYouTubeTokenProtector } from "./aes-gcm-token-protector";
import { createProcessYouTubeAuthorizationStateStore } from "./authorization-state";
import { readYouTubeConfiguration } from "./config";
import { OpenIdClientYouTubeProtocol } from "./openid-client-youtube-protocol";
import { YouTubeHttpHandlers, type YouTubeCompositionResult } from "./youtube-http";
import { ChannelSyncHttpHandlers } from "./channel-sync-http";
import { GoogleYouTubeApiAdapter } from "./youtube-api-adapter";

type YouTubeRuntime = Readonly<{ handlers: YouTubeHttpHandlers; channelHandlers: ChannelSyncHttpHandlers; disconnect(): Promise<void> }>;
let activeRuntime: YouTubeRuntime | undefined;

export function getYouTubeAuthorizationRuntime(): YouTubeRuntime {
  if (activeRuntime) return activeRuntime;
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const owned = createAnalysisRunPrismaClient(requireDatabaseUrl());
  const repository = new PrismaYouTubeAuthorizationRepository(owned.client);
  const channelRepository = new PrismaChannelSynchronizationRepository(owned.client);
  const currentSession = new CurrentSessionResolver(new PrismaSessionRepository(owned.client), new PrismaUserRepository(owned.client), new SessionTokenService(process.env.AUTH_COOKIE_SECRET), clock);
  let compositionPromise: Promise<YouTubeCompositionResult> | undefined;
  const compositionFactory = (): Promise<YouTubeCompositionResult> => {
    compositionPromise ??= createComposition(repository, channelRepository, clock, ids);
    return compositionPromise;
  };
  const channelServiceFactory = async () => {
    const composition = await compositionFactory();
    return composition.status === "success" ? composition.value.channelSynchronization : undefined;
  };
  activeRuntime = { handlers: new YouTubeHttpHandlers({ currentSession, compositionFactory, authorizationStates: createProcessYouTubeAuthorizationStateStore(clock), clock, ids, production: process.env.NODE_ENV === "production" }), channelHandlers: new ChannelSyncHttpHandlers(currentSession, channelServiceFactory), disconnect: owned.disconnect };
  return activeRuntime;
}

async function createComposition(repository: PrismaYouTubeAuthorizationRepository, channelRepository: PrismaChannelSynchronizationRepository, clock: SystemClock, ids: UuidGenerator): Promise<YouTubeCompositionResult> {
  const configuration = readYouTubeConfiguration();
  if (configuration.status === "failure") return configuration;
  try {
    const protocol = await OpenIdClientYouTubeProtocol.discover({ clientId: configuration.value.clientId, ...(configuration.value.clientSecret ? { clientSecret: configuration.value.clientSecret } : {}), redirectUri: configuration.value.redirectUri, clock });
    const protector = new AesGcmYouTubeTokenProtector(configuration.value.tokenEncryptionKeyId, { [configuration.value.tokenEncryptionKeyId]: configuration.value.tokenEncryptionSecret });
    const service = new YouTubeAuthorizationService(repository, protector, protocol, clock, ids);
    return { status: "success", value: { protocol, service, channelSynchronization: new ChannelSynchronizationService(channelRepository, repository, service, protector, new GoogleYouTubeApiAdapter(), clock, ids) } };
  } catch { return { status: "failure", error: { code: "youtube-configuration-error", message: "YouTube authorization is unavailable." } }; }
}

export async function disconnectYouTubeAuthorizationRuntime(): Promise<void> { const runtime = activeRuntime; activeRuntime = undefined; await runtime?.disconnect(); }
