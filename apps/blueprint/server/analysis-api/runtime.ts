import {
  AuthenticationService,
  createAnalysisCoreComposition,
  ExternalIdentityAuthenticationService,
  FixtureChannelDataAdapter,
  SessionService,
  SystemClock,
  UuidGenerator,
} from "../../core";
import { PrismaExternalIdentityProvisioner, PrismaIdentityRepository, PrismaSessionRepository, PrismaUserRepository, requireDatabaseUrl } from "../../core/persistence/prisma";
import { InternalAnalysisFixtureCatalog } from "./fixture-catalog";
import { InternalAnalysisApi } from "./internal-analysis-api";
import { AuthHttpHandlers, CurrentSessionResolver, GoogleOidcIdentityAdapter, InMemoryAuthorizationStateStore, OpenIdClientGoogleProtocol, SessionTokenService, readAuthConfiguration, type AuthResult } from "../auth";

type InternalAnalysisApiRuntime = {
  api: InternalAnalysisApi;
  auth: AuthHttpHandlers;
  disconnect(): Promise<void>;
};

let activeRuntime: InternalAnalysisApiRuntime | undefined;

/**
 * Server transport composition boundary. This module is imported only by
 * Node.js Route Handlers and deliberately has no client-facing export path.
 */
export function getInternalAnalysisApiRuntime(): InternalAnalysisApiRuntime {
  if (activeRuntime) {
    return activeRuntime;
  }

  const clock = new SystemClock();
  const composition = createAnalysisCoreComposition({
    databaseUrl: requireDatabaseUrl(),
    adapter: new FixtureChannelDataAdapter(clock),
    clock,
  });
  const users = new PrismaUserRepository(composition.prismaClient);
  const identities = new PrismaIdentityRepository(composition.prismaClient);
  const sessions = new PrismaSessionRepository(composition.prismaClient);
  const sessionService = new SessionService(sessions, clock);
  const tokens = new SessionTokenService(process.env.AUTH_COOKIE_SECRET);
  const ids = new UuidGenerator();
  const externalAuthentication = new ExternalIdentityAuthenticationService(
    new PrismaExternalIdentityProvisioner(composition.prismaClient),
    new AuthenticationService(users, identities, sessionService),
  );
  let adapterPromise: Promise<AuthResult<GoogleOidcIdentityAdapter>> | undefined;
  const adapterFactory = async () => {
    const configuration = readAuthConfiguration();
    if (configuration.status === "failure") return configuration;
    adapterPromise ??= OpenIdClientGoogleProtocol.discover({ clientId: configuration.value.googleClientId, ...(configuration.value.googleClientSecret ? { clientSecret: configuration.value.googleClientSecret } : {}) })
      .then((protocol) => adapterResult(new GoogleOidcIdentityAdapter(protocol, configuration.value.googleClientId, configuration.value.googleRedirectUri, clock)))
      .catch(() => ({ status: "failure" as const, error: { code: "provider-configuration-error" as const, message: "Authentication provider configuration is invalid." } }));
    return adapterPromise;
  };
  const auth = new AuthHttpHandlers({
    adapterFactory,
    authorizationStates: new InMemoryAuthorizationStateStore(clock),
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
      analysisQueryService: composition.analysisQueryService,
      fixtureCatalog: new InternalAnalysisFixtureCatalog(),
      clock,
      requestIdGenerator: new UuidGenerator(),
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
