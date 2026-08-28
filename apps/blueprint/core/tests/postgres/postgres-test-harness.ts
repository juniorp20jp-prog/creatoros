import {
  createAnalysisRunPrismaClient,
  PrismaAnalysisRunRepository,
  type OwnedAnalysisRunPrismaClient,
} from "../../persistence/prisma";
import type { Clock } from "../../services";

const TEST_CREATOR_PREFIXES = ["creator_test", "creator_fixture_"] as const;

export function requireTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "TEST_DATABASE_URL is required for PostgreSQL integration tests.",
    );
  }
  if (value === process.env.DATABASE_URL?.trim()) {
    throw new Error("TEST_DATABASE_URL must be isolated from DATABASE_URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.pathname.toLowerCase().includes("test")
  ) {
    throw new Error(
      "TEST_DATABASE_URL must target a database whose name contains test.",
    );
  }
  return value;
}

export async function deleteOwnedPostgresTestRows(
  owned: OwnedAnalysisRunPrismaClient,
): Promise<void> {
  await owned.client.channelSyncRow.deleteMany({
    where: { userId: { startsWith: "auth_test_" } },
  });
  await owned.client.youTubeChannelRow.deleteMany({
    where: { userId: { startsWith: "auth_test_" } },
  });
  await owned.client.youTubeTokenRow.deleteMany({
    where: { identity: { userId: { startsWith: "auth_test_" } } },
  });
  await owned.client.youTubeIdentityRow.deleteMany({
    where: { userId: { startsWith: "auth_test_" } },
  });
  await owned.client.sessionRow.deleteMany({
    where: { userId: { startsWith: "auth_test_" } },
  });
  await owned.client.identityRow.deleteMany({
    where: { userId: { startsWith: "auth_test_" } },
  });
  await owned.client.userRow.deleteMany({
    where: { userId: { startsWith: "auth_test_" } },
  });
  await owned.client.analysisRunRow.deleteMany({
    where: {
      OR: TEST_CREATOR_PREFIXES.map((prefix) => ({
        creatorId: { startsWith: prefix },
      })),
    },
  });
}

export async function createPostgresTestHarness(clock: Clock): Promise<{
  owned: OwnedAnalysisRunPrismaClient;
  repository: PrismaAnalysisRunRepository;
}> {
  const owned = createAnalysisRunPrismaClient(requireTestDatabaseUrl());
  await deleteOwnedPostgresTestRows(owned);
  return {
    owned,
    repository: new PrismaAnalysisRunRepository(owned.client, clock),
  };
}
