# Analysis Run Persistence

This module is the storage-agnostic boundary for CreatorOS analysis history.
Its public V2 contract stores provider-neutral Creator Intelligence results
without coupling Core to a database, API, job runner, or presentation layer.

## V2 architecture

```text
Source payload (ephemeral)
  -> ChannelDataAdapter
  -> RawChannelData (ephemeral)
  -> CreatorIntelligenceAnalysisPipeline
  -> AnalysisResult
  -> AnalysisRunRepository
  -> AnalysisRun
  -> Persistence mapper
  -> AnalysisRunPersistenceRecord
  -> Future durable repository
```

`AnalysisRunOrchestrator` coordinates this flow. It creates a pending run,
moves it to processing, executes the injected adapter and deterministic
pipeline, and then persists either a completed result or a controlled failure.
Clocks and ID generators are injected so tests and future job infrastructure
remain deterministic.

Responsibilities remain separate:

- `analysis-run-model.ts` owns the provider-neutral domain contract.
- `analysis-run-persistence-record.ts` owns the JSON-safe storage shape.
- `analysis-run-persistence-mapper.ts` validates both directions between the
  domain model and storage record.
- `analysis-run-lifecycle.ts` is the single source of truth for state changes.
- `analysis-run-repository.ts` defines storage behavior.
- `analysis-run-repository-error.ts` defines typed boundary failures.
- `analysis-run-retention.ts` creates non-destructive retention plans.
- `persistence-record-migrator.ts` is the explicit future migration boundary.
- `analysis-run-orchestrator.ts` coordinates adapters, the pipeline, and
  persistence without implementing their domain behavior.
- `in-memory-analysis-run-repository.ts` is a local reference implementation
  for tests and composition experiments only.

## Domain model and persistence record

`AnalysisRun` is the domain-facing representation returned by repositories. It
contains:

- stable run, creator, and channel identifiers;
- `pending`, `processing`, `completed`, or `failed` status;
- source type, source schema version, and an optional safe reference;
- adapter identity, version, processing timestamp, and warnings when available;
- the Creator Intelligence pipeline version;
- `AnalysisResult` only after successful completion;
- creation, update, and terminal timestamps;
- a typed failure stage, code, and safe message after failure;
- optional correlation and retry metadata;
- a positive optimistic-concurrency `revision`.

`AnalysisRunPersistenceRecord` is separate from the domain model. It contains
only strings, finite numbers, booleans, null, arrays, and plain objects. It
contains no `Date`, function, class instance, raw source payload, ORM entity, or
infrastructure-specific value. Optional domain values represented by
`undefined` are canonically omitted from the record.

`mapAnalysisRunToPersistenceRecord` and
`mapPersistenceRecordToAnalysisRun` validate schema versions, canonical UTC
timestamps, required fields, terminal payload invariants, identities, JSON
safety, and the complete provider-neutral `AnalysisResult` shape. Corrupt or
incompatible values return discriminated mapping errors; values are not
silently repaired.

## Lifecycle policy

Allowed state changes are intentionally narrow:

```text
pending -> processing -> completed
                      \-> failed
```

Terminal runs cannot be reopened or overwritten. `complete` and `fail` are
explicit repository operations so terminal payloads cannot be attached through
a generic status update. Duplicate IDs and invalid transitions return typed
errors instead of replacing records.

New runs start at revision 1. Every valid state mutation increments the
revision. Mutation callers may provide `expectedRevision`; a stale value
returns `concurrency-conflict` with expected and actual revisions and leaves
the record unchanged. This is the portable compare-and-swap behavior a future
SQL implementation must enforce atomically.

Retries create a new run with a new identifier. `attempt`,
`retryOfAnalysisRunId`, and `correlationId` preserve traceability without
mutating a previous terminal run.

## Repository behavior

`AnalysisRunRepository` is asynchronous so a future durable adapter can
implement it without changing callers. It supports:

- creating and retrieving runs;
- controlled status changes, completion, and failure;
- channel-scoped history;
- optional status filtering;
- stable cursor pagination;
- retrieving the latest completed channel analysis;
- explicit `deleteById` and `deleteMany` operations.

History is ordered by `createdAt` descending and then `analysisRunId` ascending
as a stable tie-break. Cursors are run IDs from the filtered result set. The
in-memory repository keeps instance-local state and clones every value at
ingress and egress, preventing callers from mutating stored history.

The in-memory implementation is not production persistence. It loses data with
the process and must never be used as a substitute for an approved durable
adapter.

`runAnalysisRunRepositoryContractTests` is a reusable test factory. Every
future durable implementation must run the same creation, isolation, lifecycle,
query, pagination, compatibility, and terminal-protection contract used by the
in-memory implementation.

Deletion is never inferred from a query. `deleteMany` requires at least one
explicit, unique ID, validates all IDs and expected revisions before changing
state, and provides no delete-all operation. The orchestrator never deletes
runs.

## Errors and compatibility

Expected persistence failures are discriminated results with stable codes:

- `duplicate-id`
- `not-found`
- `invalid-transition`
- `concurrency-conflict`
- `version-incompatibility`
- `persistence-failure`
- `invalid-query`

V2 refuses unsupported schema versions when creating, mapping, and reading
records. `PersistenceRecordMigrator` defines the future migration boundary.
The current implementation validates records already at V2 and explicitly
rejects unknown sources, unsupported targets, and unavailable migration paths.
It performs no migration. Future N to N+1 transformations must be individually
implemented, tested, and executed before normal repository mapping; records
must never be guessed, silently repaired, or automatically migrated on read.

## Retention planning

`planAnalysisRunRetention` is a pure, deterministic planner. It supports:

- keeping every run indefinitely;
- keeping a maximum number of unprotected runs per channel;
- keeping runs within a maximum age;
- protecting selected run IDs;
- marking a plan as dry-run.

The plan separates retained runs from deletion candidates and gives every
decision a stable reason. It sorts and evaluates each channel independently.
Planning never deletes data. Applying a reviewed plan requires a separate,
explicit `deleteMany` call with the selected IDs and, when available, expected
revisions. There are no cron jobs, background cleanup tasks, or implicit
retention side effects.

## Privacy and data minimization

Raw source payloads and normalized `RawChannelData` are transient and are not
part of `AnalysisRun`. V2 persists only safe source metadata, adapter
diagnostics, the provider-neutral analysis result, and execution metadata.
Provider credentials, authorization headers, cookies, tokens, and arbitrary
source fields must never be stored in a record. Complete provider responses,
stack traces, exception objects, and `RawChannelData` are also prohibited.

`sourceReference` is intended for an opaque, non-secret reference. Callers are
responsible for ensuring it contains no credential or private source payload.
Failure messages must be controlled diagnostic copy rather than raw exception
objects or provider responses.

Retention and deletion apply to analysis records only; they do not imply that
provider payloads exist. Future erasure requests must resolve the exact
analysis-run IDs, protect authorization at the application boundary, generate
a reviewable plan, and then call explicit deletion. This Core module does not
implement identity, authorization, legal-retention decisions, or automatic
erasure.

## Adding durable persistence

A future database adapter should:

1. Implement `AnalysisRunRepository` without changing the public model.
2. Enforce unique `analysisRunId` values atomically.
3. Map domain values through `AnalysisRunPersistenceRecord`.
4. Enforce lifecycle changes with `WHERE revision = expectedRevision` or an
   equivalent atomic compare-and-swap and increment.
5. Implement explicit ID-based deletion transactionally.
6. Run the reusable repository conformance suite.
7. Store and query by channel, status, creation time, and run ID.
8. Preserve stable history ordering and cursor semantics.
9. Validate or explicitly migrate the schema version before reading a record.
10. Map infrastructure failures to the public typed error taxonomy.
11. Return defensive domain values rather than ORM entities.
12. Keep credentials, raw source payloads, and database details outside Core
    records.

No database selection, migration framework, external API, authentication, or
background execution is introduced by this foundation.

There is still no durable persistence. `InMemoryAnalysisRunRepository` remains
development and test infrastructure only. This sprint selects no provider,
installs no database, and performs no disk or network storage.

## Legacy V1 compatibility

Sprint 9 introduced `CreatorAnalysisRun`, its serializer/parser, and
`CreatorAnalysisRunRepository`. That V1 aggregate stores historical YouTube,
Creator Intelligence, and decision snapshots and remains exported to avoid
breaking existing consumers. Its repository uses `save`, `findById`, and
`listRecent`.

V1 is a legacy compatibility contract. New Creator Intelligence persistence
should use the provider-neutral V2 `AnalysisRunRepository`. V1 records are not
implicitly converted to V2 because their domain shape and raw snapshot policy
are different. Any migration requires a separately approved, explicit mapping.
