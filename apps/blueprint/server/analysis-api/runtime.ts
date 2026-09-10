import {
  AnalysisRunOrchestrator,
  AnalysisService,
  AuthenticationService,
  createAnalysisCoreComposition,
  ConnectedYouTubeStrategicPipeline,
  ExternalIdentityAuthenticationService,
  FixtureChannelDataAdapter,
  PersistedYouTubeChannelDataAdapter,
  SessionService,
  SystemClock,
  UuidGenerator,
} from "../../core";
import {
  PrismaChannelSynchronizationRepository,
  PrismaExternalIdentityProvisioner,
  PrismaIdentityRepository,
  PrismaSessionRepository,
  PrismaUserRepository,
  PrismaVideoSynchronizationRepository,
  requireDatabaseUrl,
} from "../../core/persistence/prisma";
import { InternalAnalysisFixtureCatalog } from "./fixture-catalog";
import { InternalAnalysisApi } from "./internal-analysis-api";
import { PersistedYouTubeSourceResolver } from "./persisted-youtube-source-resolver";
import {
  AuthHttpHandlers,
  CurrentSessionResolver,
  GoogleOidcIdentityAdapter,
  OpenIdClientGoogleProtocol,
  SessionTokenService,
  createProcessAuthorizationStateStore,
  readAuthConfiguration,
  type AuthResult,
} from "../auth";

type InternalAnalysisApiRuntime = {
  api: InternalAnalysisApi;
  auth: AuthHttpHandlers;
  disconnect(): Promise<void>;
};

let activeRuntime: InternalAnalysisApiRuntime | undefined;

export function getInternalAnalysisApiRuntime(): InternalAnalysisApiRuntime {
  if (activeRuntime) return activeRuntime;

  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const composition = createAnalysisCoreComposition({
    databaseUrl: requireDatabaseUrl(),
    adapter: new FixtureChannelDataAdapter(clock),
    clock,
    idGenerator: ids,
  });
  const users = new PrismaUserRepository(composition.prismaClient);
  const identities = new PrismaIdentityRepository(composition.prismaClient);
  const sessions = new PrismaSessionRepository(composition.prismaClient);
  const channels = new PrismaChannelSynchronizationRepository(composition.prismaClient);
  const videos = new PrismaVideoSynchronizationRepository(composition.prismaClient);
  const sessionService = new SessionService(sessions, clock);
  const tokens = new SessionTokenService(process.env.AUTH_COOKIE_SECRET);
  const externalAuthentication = new ExternalIdentityAuthenticationService(
    new PrismaExternalIdentityProvisioner(composition.prismaClient),
    new AuthenticationService(users, identities, sessionService),
  );
  const connectedOrchestrator = new AnalysisRunOrchestrator(
    new PersistedYouTubeChannelDataAdapter(clock),
    composition.repository,
    new ConnectedYouTubeStrategicPipeline(),
    clock,
    ids,
  );
  const connectedAnalysisService = new AnalysisService(
    connectedOrchestrator,
    composition.repository,
  );
  const connectedSourceResolver = new PersistedYouTubeSourceResolver(
    channels,
    videos,
    videos,
    clock,
  );

  let adapterPromise: Promise<AuthResult<GoogleOidcIdentityAdapter>> | undefined;
  const adapterFactory = async () => {
    const configuration = readAuthConfiguration();
    if (configuration.status === "failure") return configuration;
    adapterPromise ??= OpenIdClientGoogleProtocol.discover({
      clientId: configuration.value.googleClientId,
      ...(configuration.value.googleClientSecret
        ? { clientSecret: configuration.value.googleClientSecret }
        : {}),
    })
      .then((protocol) =>
        adapterResult(
          new GoogleOidcIdentityAdapter(
            protocol,
            configuration.value.googleClientId,
            configuration.value.googleRedirectUri,
            clock,
          ),
        ),
      )
      .catch(() => ({
        status: "failure" as const,
        error: {
          code: "provider-configuration-error" as const,
          message: "Authentication provider configuration is invalid.",
        },
      }));
    return adapterPromise;
  };

  const auth = new AuthHttpHandlers({
    adapterFactory,
    authorizationStates: createProcessAuthorizationStateStore(clock),
    externalAuthentication,
    sessionService,
    currentSession: new CurrentSessionResolver(sessions, users, tokens, clock),
    tokens,
    clock,
    ids,
    production: process.env.NODE_ENV === "production",
  });
  const runtime: InternalAnalysisApiRuntime = {
    api: new InternalAnalysisApi({
      analysisService: composition.analysisService,
      connectedYouTube: {
        analysisService: connectedAnalysisService,
        sourceResolver: connectedSourceResolver,
      },
      analysisQueryService: composition.analysisQueryService,
      fixtureCatalog: new InternalAnalysisFixtureCatalog(),
      clock,
      requestIdGenerator: ids,
    }),
    auth,
    disconnect: composition.disconnect,
  };
  activeRuntime = runtime;
  return runtime;
}

function adapterResult(value: GoogleOidcIdentityAdapter) {
  return { status: "success" as const, value };
}

export async function disconnectInternalAnalysisApiRuntime(): Promise<void> {
  const runtime = activeRuntime;
  activeRuntime = undefined;
  await runtime?.disconnect();
}