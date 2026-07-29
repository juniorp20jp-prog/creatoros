import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  type PrismaClient as GeneratedPrismaClient,
} from "./generated/client";
import { requireDatabaseUrl } from "./database-url";

export type AnalysisRunPrismaClient = GeneratedPrismaClient;

export type OwnedAnalysisRunPrismaClient = {
  client: AnalysisRunPrismaClient;
  disconnect(): Promise<void>;
};

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "PostgreSQL persistence is available only in a server runtime.",
    );
  }
}

/**
 * Creates one explicitly owned client. The application composition root must
 * reuse the returned client and call disconnect during controlled shutdown.
 * Repository operations never create clients or connection pools.
 */
export function createAnalysisRunPrismaClient(
  databaseUrl: string = requireDatabaseUrl(),
): OwnedAnalysisRunPrismaClient {
  assertServerRuntime();
  if (databaseUrl.trim().length === 0) {
    throw new Error("A non-empty PostgreSQL connection string is required.");
  }

  const adapter = new PrismaPg(databaseUrl);
  const client = new PrismaClient({ adapter });

  return {
    client,
    disconnect: async () => {
      await client.$disconnect();
    },
  };
}
