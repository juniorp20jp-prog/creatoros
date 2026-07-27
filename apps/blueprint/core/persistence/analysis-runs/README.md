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
  -> AnalysisRun history
```

`AnalysisRunOrchestrator` coordinates this flow. It creates a pending run,
moves it to processing, executes the injected adapter and deterministic
pipeline, and then persists either a completed result or a controlled failure.
Clocks and ID generators are injected so tests and future job infrastructure
remain deterministic.

Responsibilities remain separate:

- `analysis-run-model.ts` owns the provider-neutral persisted contract.
- `analysis-run-lifecycle.ts` is the single source of truth for state changes.
- `analysis-run-repository.ts` defines storage behavior.
- `analysis-run-repository-error.ts` defines typed boundary failures.
- `analysis-run-orchestrator.ts` coordinates adapters, the pipeline, and
  persistence without implementing their domain behavior.
- `in-memory-analysis-run-repository.ts` is a local reference implementation
  for tests and composition experiments only.

## Persisted contract

`ANALYSIS_RUN_SCHEMA_VERSION` identifies the V2 record shape. An `AnalysisRun`
contains:

- stable run, creator, and channel identifiers;
- `pending`, `processing`, `completed`, or `failed` status;
- source type, source schema version, and an optional safe reference;
- adapter identity, version, processing timestamp, and warnings when available;
- the Creator Intelligence pipeline version;
- `AnalysisResult` only after successful completion;
- creation, update, and terminal timestamps;
- a typed failure stage, code, and safe message after failure;
- optional correlation and retry metadata.

The model is useful to future APIs and UI consumers because querying and
storage are expressed only through Core types. Consumers do not need to know
which concrete database or source adapter is used.

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
- retrieving the latest completed channel analysis.

History is ordered by `createdAt` descending and then `analysisRunId` ascending
as a stable tie-break. Cursors are run IDs from the filtered result set. The
in-memory repository keeps instance-local state and clones every value at
ingress and egress, preventing callers from mutating stored history.

The in-memory implementation is not production persistence. It loses data with
the process and must never be used as a substitute for an approved durable
adapter.

## Errors and compatibility

Expected persistence failures are discriminated results with stable codes:

- `duplicate-id`
- `not-found`
- `invalid-transition`
- `version-incompatibility`
- `persistence-failure`
- `invalid-query`

V2 refuses unsupported schema versions both when creating and reading records.
A durable implementation must inspect `schemaVersion` before mapping data.
Future incompatible shapes require an explicit new version and migration or
version-dispatch path; records must never be guessed or silently repaired.

## Privacy and data minimization

Raw source payloads and normalized `RawChannelData` are transient and are not
part of `AnalysisRun`. V2 persists only safe source metadata, adapter
diagnostics, the provider-neutral analysis result, and execution metadata.
Provider credentials, authorization headers, cookies, tokens, and arbitrary
source fields must never be stored in a run.

`sourceReference` is intended for an opaque, non-secret reference. Callers are
responsible for ensuring it contains no credential or private source payload.
Failure messages must be controlled diagnostic copy rather than raw exception
objects or provider responses.

## Adding durable persistence

A future database adapter should:

1. Implement `AnalysisRunRepository` without changing the public model.
2. Enforce unique `analysisRunId` values atomically.
3. Enforce the lifecycle policy under concurrent updates.
4. Store and query by channel, status, creation time, and run ID.
5. Preserve stable history ordering and cursor semantics.
6. Validate the schema version before reading a record.
7. Map infrastructure failures to the public typed error taxonomy.
8. Return defensive domain values rather than ORM entities.
9. Keep credentials, raw source payloads, and database details outside Core
   records.

No database selection, migration framework, external API, authentication, or
background execution is introduced by this foundation.

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
