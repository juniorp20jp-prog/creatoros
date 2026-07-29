# PostgreSQL Analysis Run Repository

This folder is the server-only infrastructure adapter for V2 analysis runs.
Consumers outside a server composition root should import the neutral contract
from `core/persistence`, not this folder.

## Setup

Requirements:

- Node.js supported by the workspace;
- an isolated PostgreSQL database;
- `DATABASE_URL` for Prisma CLI and application composition;
- `TEST_DATABASE_URL` for integration tests.

Copy `.env.example` only as a template. Keep real values in the environment or
the deployment secret manager. Never commit local environment files.

Installing the workspace runs this generation automatically. It can also be
run explicitly without a database connection:

```text
pnpm --filter blueprint prisma:generate
```

Generation uses `prisma.generate.config.ts`, which has no datasource and never
contacts PostgreSQL. Database validation and every migration command use the
strict `prisma.config.ts`; that configuration fails when `DATABASE_URL` is
missing.

Create a reviewed migration during local schema development:

```text
pnpm --filter blueprint prisma:migrate:dev -- --name descriptive_name
```

Apply committed migrations in test, staging, and production:

```text
pnpm --filter blueprint prisma:migrate:deploy
```

`prisma db push` is intentionally not part of this workflow.

## Composition

Create the Prisma client once in a server-owned composition root, inject its
`client` into `PrismaAnalysisRunRepository`, and reuse the repository. Call
`disconnect()` during controlled shutdown. Do not create a new client per
request or repository operation.

```ts
import {
  createAnalysisRunPrismaClient,
  PrismaAnalysisRunRepository,
} from "./core/persistence/prisma";

const owned = createAnalysisRunPrismaClient();
const repository = new PrismaAnalysisRunRepository(owned.client);
```

The default Core barrel deliberately does not export this adapter, preventing
accidental client-bundle imports. Application server wiring must use the
explicit infrastructure entry point.

## Index rationale

- The primary key serves ID lookup, lifecycle writes, and explicit deletion.
- `(channel_id, created_at DESC, analysis_run_id ASC)` serves channel history,
  cursor ordering, and latest-completed ordering before its status predicate.
- `(channel_id, status, created_at DESC, analysis_run_id ASC)` serves filtered
  history and latest completed lookups.
- `revision` is evaluated after the primary-key lookup during compare-and-swap;
  it does not justify a separate index.
- Correlation and retry fields have no current repository query, so they are
  intentionally not indexed.

## Test database

The database suite is destructive only to rows owned by its fixture creator
prefixes. It rejects a missing URL, a URL equal to `DATABASE_URL`, and a
database name that does not contain `test`.

Apply migrations to the isolated test database before running:

```text
DATABASE_URL=<same isolated test URL> pnpm --filter blueprint prisma:migrate:deploy
TEST_DATABASE_URL=<isolated test URL> pnpm --filter blueprint test:postgres
```

The suite runs serially and covers the shared repository contract, persistence
across clients, competing writes, atomic batch deletion, corrupt and
incompatible rows, privacy boundaries, and real orchestrator flows.

## Operations

Local development may use any isolated PostgreSQL instance. Staging and
production should inject the URL from their secret manager, use separate
databases and credentials, and run `prisma:migrate:deploy` as a controlled
release step before application traffic reaches code that requires the new
schema.

Before production migrations:

1. verify migration status in the target environment;
2. take and verify a restorable database backup;
3. apply the committed migration;
4. run a read/write smoke test through the repository;
5. monitor database and application error rates.

Rollback is not `db push`, migration-file editing, or destructive history
rewriting. Restore the verified backup when data recovery is required and ship
a reviewed compensating migration for schema correction. Backup schedules,
retention periods, encryption, point-in-time recovery, and restore drills are
deployment responsibilities and must be defined before commercial launch.

## Privacy and retention

Only the provider-neutral persistence record crosses this adapter. Raw source
data and credentials remain ephemeral. Infrastructure exceptions are mapped to
safe repository errors; connection strings and database messages are not
returned.

Retention planning does not touch PostgreSQL. An authorized application layer
must review candidates and explicitly call revision-aware deletion. This module
does not add cron jobs, automatic cleanup, authentication, authorization, or
legal-retention decisions.

## Known V1 limits

- There is no managed PostgreSQL provider selection.
- No connection-pool sizing policy is encoded; deployment must tune it.
- No automatic retry policy is present.
- No background migration or retention worker is present.
- Schema V2 is the only readable durable analysis-run version.
- Real readiness requires passing the PostgreSQL suite against the target
  database engine, not only Prisma schema validation or mocks.
