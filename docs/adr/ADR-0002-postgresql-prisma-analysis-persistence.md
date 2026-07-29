# ADR-0002: PostgreSQL and Prisma for durable analysis persistence

- Status: Accepted
- Date: 2026-07-28
- Scope: `apps/blueprint` CreatorOS Core persistence

## Context

`AnalysisRunRepository` is the provider-neutral boundary introduced before a
durable database was selected. The in-memory implementation proves behavior
but loses data when its process exits. CreatorOS now needs durable analysis
history, stable channel queries, explicit deletion, and concurrency guarantees
without coupling the domain to one deployment vendor.

Analysis records contain structured Creator Intelligence results and metadata.
They must not contain provider credentials, raw channel payloads, authorization
headers, or arbitrary provider responses.

## Decision

CreatorOS uses PostgreSQL as the durable relational database, Prisma ORM with
the `pg` driver adapter as its TypeScript data-access layer, and Prisma Migrate
for versioned schema changes.

The boundary remains:

```text
AnalysisRun
  <-> authoritative domain persistence mapper
  <-> AnalysisRunPersistenceRecord
  <-> Prisma row mapper
  <-> PrismaAnalysisRunRepository
  <-> Prisma Client / pg adapter
  <-> PostgreSQL
```

`PrismaAnalysisRunRepository` implements the existing
`AnalysisRunRepository` exactly. It does not create a second repository
contract. Domain and orchestrator code do not import Prisma.

The Prisma schema, migrations, generated-client configuration, repository, and
database tests belong to `apps/blueprint`, the current owner of CreatorOS Core.
No extra workspace package is warranted yet.

## Data design

Fields used for identity, filtering, ordering, compatibility, and optimistic
concurrency are explicit relational columns. Provider-neutral structured
metadata, warnings, result, and failure objects use JSONB. Required indexes
cover identifier lookup, channel history, and channel-and-status history.
Correlation and retry metadata remain columns but have no speculative index
until a repository query requires one.

The database stores only the V2 `AnalysisRunPersistenceRecord` projection.
`RawChannelData`, raw provider payloads, secrets, cookies, tokens, stack traces,
and ORM objects are excluded. The existing mapper validates all rows before
they become domain values; corrupt and unsupported records produce typed safe
failures rather than silent repair.

## Concurrency and lifecycle

Every state mutation first constructs a valid next domain record, then performs
one conditional SQL update matching the identifier, current revision, and
current status. The new revision is written in the same statement. A zero-row
update is diagnosed as `not-found` or `concurrency-conflict`; it is never
retried as an unconditional write.

Explicit multi-record deletion runs in a transaction. It validates every ID
and revision, deletes only the captured `(id, revision)` pairs, and rolls back
if the affected-row count changes. No delete-all API exists.

## Client lifecycle and secrets

The PostgreSQL adapter is exposed only from
`core/persistence/prisma/index.ts`, not from the provider-neutral Core barrel.
A server composition root creates one explicitly owned Prisma client and
reuses it across repository operations. Tests and controlled shutdown call
`disconnect`; repository methods never create clients or pools.

`DATABASE_URL` is required at runtime and for migration commands. It is read
from environment configuration, never logged, hardcoded in source, returned in
errors, or stored in run metadata. `TEST_DATABASE_URL` must point to an
isolated database whose name contains `test`.

## Migrations

All schema changes use committed Prisma Migrate files. `prisma db push` is not
an accepted deployment path. Development creates reviewed migrations;
staging/production apply them with `prisma migrate deploy`. Rollback is
forward-only: restore from a verified backup if data must be recovered, then
apply a reviewed compensating migration. Editing an already-applied migration
is prohibited.

## Retention

The existing retention planner remains pure and non-destructive. It only
produces candidates. Applying a reviewed plan still requires an explicit,
revision-aware repository deletion. No background deletion, scheduled
retention, or automatic privacy erasure is introduced.

## Consequences

- PostgreSQL becomes required for production durable analysis history.
- Prisma Client generation is an explicit setup/build prerequisite.
- Real PostgreSQL conformance, concurrency, and orchestrator tests are required
  before declaring the durable repository ready.
- Database outage details remain behind the typed repository error boundary.
- Future schema versions require explicit migration and mapper support.
- A provider-specific managed PostgreSQL service can be selected later without
  changing the Core contract.
