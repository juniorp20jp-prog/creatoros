# Analysis Query and History Layer

`AnalysisQueryService` is the read-only application boundary for persisted
analysis runs. It accepts `AnalysisRunRepository` and `Clock` through its
constructor. It never executes analysis, writes data, exposes Prisma, or returns
the persistence entity directly.

## Read models

- `AnalysisSummary` provides list-safe identity, status, lineage, warnings, and
  timestamps.
- `AnalysisDetails` adds cloned analytical output, source metadata, and a safe
  failure model.
- `AnalysisHistoryItem` represents replay lineage without persistence methods.
- `AnalysisStatusSummary` counts the five read statuses.
- `PaginationResult<T>` and `CursorResult` expose cursor-only pagination.

A completed run with adapter warnings is represented as `partial`. It remains a
completed persistence record; the distinction is derived only in the read
model.

## Queries

The public service supports:

- reading by analysis run ID;
- stable chronological lists;
- latest, failed, completed, and partial lists;
- exact creator, channel, attempt, and analysis ID filters;
- inclusive creation date ranges;
- complete replay history;
- existence checks, counts, and status summaries.

The current repository contract scopes lists to one channel, so `channelId` is
required for collection queries. This preserves repository boundaries without
adding query logic to the write model.

## Cursor contract

Query cursors are opaque, deterministic, versioned, and bound to a canonical
filter signature. Internally they carry the repository cursor of the last
returned item. Reusing a cursor with different filters returns a typed
`invalid-cursor` failure. Offset pagination is not supported.

## History

History resolves the oldest available ancestor, then follows
`retryOfAnalysisRunId` transitively. Results are returned oldest first with
stable analysis-run ID ordering for equal timestamps. Deleted ancestors are not
reconstructed.

## Composition

`createAnalysisCoreComposition()` is the first Core composition root. It owns
one Prisma client and wires repository, orchestrator, command service, and query
service. Callers must invoke `disconnect()` during controlled shutdown.
