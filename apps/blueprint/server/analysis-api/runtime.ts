import {
  createAnalysisCoreComposition,
  FixtureChannelDataAdapter,
  SystemClock,
  UuidGenerator,
} from "../../core";
import { requireDatabaseUrl } from "../../core/persistence/prisma";
import { InternalAnalysisFixtureCatalog } from "./fixture-catalog";
import { InternalAnalysisApi } from "./internal-analysis-api";

type InternalAnalysisApiRuntime = {
  api: InternalAnalysisApi;
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
  const runtime: InternalAnalysisApiRuntime = {
    api: new InternalAnalysisApi({
      analysisService: composition.analysisService,
      analysisQueryService: composition.analysisQueryService,
      fixtureCatalog: new InternalAnalysisFixtureCatalog(),
      clock,
      requestIdGenerator: new UuidGenerator(),
    }),
    disconnect: composition.disconnect,
  };
  activeRuntime = runtime;
  return runtime;
}

export async function disconnectInternalAnalysisApiRuntime(): Promise<void> {
  const runtime = activeRuntime;
  activeRuntime = undefined;
  await runtime?.disconnect();
}
