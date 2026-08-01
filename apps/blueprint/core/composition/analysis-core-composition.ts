import type {
  ChannelDataAdapter,
} from "../adapters";
import {
  CreatorIntelligenceAnalysisPipeline,
} from "../engines";
import {
  AnalysisRunOrchestrator,
} from "../persistence";
import {
  createAnalysisRunPrismaClient,
  type AnalysisRunPrismaClient,
  PrismaAnalysisRunRepository,
} from "../persistence/prisma";
import {
  AnalysisQueryService,
  AnalysisService,
  SystemClock,
  UuidGenerator,
  type Clock,
  type IdGenerator,
} from "../services";

export type AnalysisCoreCompositionOptions<TSource> = {
  databaseUrl: string;
  adapter: ChannelDataAdapter<TSource>;
  pipeline?: CreatorIntelligenceAnalysisPipeline;
  clock?: Clock;
  idGenerator?: IdGenerator;
};

export type AnalysisCoreComposition<TSource> = {
  repository: PrismaAnalysisRunRepository;
  orchestrator: AnalysisRunOrchestrator<TSource>;
  analysisService: AnalysisService<TSource>;
  analysisQueryService: AnalysisQueryService;
  prismaClient: AnalysisRunPrismaClient;
  disconnect(): Promise<void>;
};

export function createAnalysisCoreComposition<TSource>(
  options: AnalysisCoreCompositionOptions<TSource>,
): AnalysisCoreComposition<TSource> {
  const databaseUrl = options.databaseUrl.trim();
  if (databaseUrl.length === 0) {
    throw new Error(
      "Analysis Core composition requires a non-empty database URL.",
    );
  }

  const clock = options.clock ?? new SystemClock();
  const idGenerator =
    options.idGenerator ?? new UuidGenerator();
  const ownedClient =
    createAnalysisRunPrismaClient(databaseUrl);
  const repository = new PrismaAnalysisRunRepository(
    ownedClient.client,
    clock,
  );
  const orchestrator = new AnalysisRunOrchestrator(
    options.adapter,
    repository,
    options.pipeline ??
      new CreatorIntelligenceAnalysisPipeline(),
    clock,
    idGenerator,
  );
  const analysisService = new AnalysisService(
    orchestrator,
    repository,
  );
  const analysisQueryService = new AnalysisQueryService(
    repository,
    clock,
  );

  return {
    repository,
    orchestrator,
    analysisService,
    analysisQueryService,
    prismaClient: ownedClient.client,
    disconnect: ownedClient.disconnect,
  };
}
