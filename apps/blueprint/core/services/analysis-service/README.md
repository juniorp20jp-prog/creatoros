# Analysis Service Layer

`AnalysisService` is the application-facing entry point for persisted creator
analysis. It coordinates the existing `AnalysisRunOrchestrator` and
`AnalysisRunRepository`; it does not implement adapter, pipeline, scoring, or
storage rules.

## Composition

```ts
const orchestrator = new AnalysisRunOrchestrator(
  adapter,
  repository,
  pipeline,
  clock,
  idGenerator,
);
const service = new AnalysisService(orchestrator, repository);
```

Both dependencies are constructor-injected. The service creates no singleton,
does not read environment variables, and remains independent of Prisma.

## Flow

`runAnalysis()` delegates this existing flow:

1. Source fixture enters the injected adapter.
2. The adapter produces provider-neutral `RawChannelData`.
3. The Creator Intelligence pipeline produces `AnalysisResult`.
4. The orchestrator completes the versioned `AnalysisRun`.
5. The repository persists the terminal run atomically.
6. The service returns both the persisted run and its `AnalysisResult`.

The repository never receives the source fixture or `RawChannelData`.

## Public operations

- `runAnalysis()` executes and persists one analysis.
- `getAnalysis()` reads a run by its stable identifier.
- `listAnalysisRuns()` exposes repository pagination and status filters.
- `deleteAnalysis()` supports optimistic concurrency through
  `expectedRevision`.
- `replayAnalysis()` reads the original run and creates a new run with an
  incremented attempt and `retryOfAnalysisRunId`.

## Replay boundary

Raw provider data is intentionally not persisted. A replay caller must provide
the fixture source again. The original run supplies creator/channel identity,
correlation metadata, source reference, retry lineage, and attempt number.
The previous run is never overwritten.

## Errors and consistency

Every method returns `AnalysisServiceResult<T>`. Adapter, pipeline,
persistence, repository, validation, not-found, and concurrency failures remain
typed and include operation context. Unexpected dependency exceptions are
converted to a safe contextual failure without exposing stack traces.

The orchestrator writes `AnalysisResult` only in the terminal completion
mutation. If completion persistence fails, no partial analysis result is
stored.
