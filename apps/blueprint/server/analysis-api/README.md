# Internal Analysis API v1

This module is the server-side HTTP transport for CreatorOS analysis. It is
owned by `apps/blueprint`, the same Next.js application that owns the Analysis
Core. It is internal, unauthenticated, and **not suitable for public Internet
exposure** in its current form.

## Architecture

```text
Next.js Route Handler
  -> runtime validation
  -> InternalAnalysisApi transport
  -> AnalysisService / AnalysisQueryService
  -> PrismaAnalysisRunRepository
  -> PostgreSQL
  -> Core read model or command result
  -> stable HTTP envelope
```

Route files contain no domain or persistence logic. `runtime.ts` lazily creates
one process-local Core Composition Root and reuses it across requests. It also
provides an explicit disconnect operation for tests. The runtime is imported
only by Node.js Route Handlers; client components have no export path to it.

The API does not import Prisma in its transport, duplicate Core mappers, expose
repository entities, calculate scores, or reconstruct history. All reads use
official read models from `AnalysisQueryService`.

## Routes

All routes use `/api/internal/v1`.

| Method | Route | Application operation | Success |
| --- | --- | --- | --- |
| `POST` | `/analysis-runs` | `AnalysisService.runAnalysis` | `201` |
| `GET` | `/analysis-runs` | `AnalysisQueryService.listAnalysisRuns` | `200` |
| `GET` | `/analysis-runs/:analysisRunId` | `AnalysisQueryService.getAnalysisById` | `200` |
| `DELETE` | `/analysis-runs/:analysisRunId` | `AnalysisService.deleteAnalysis` | `200` |
| `POST` | `/analysis-runs/:analysisRunId/replay` | `AnalysisService.replayAnalysis` | `201` |
| `GET` | `/analysis-runs/:analysisRunId/history` | `AnalysisQueryService.getAnalysisHistory` | `200` |
| `GET` | `/analysis-runs/status-summary` | `AnalysisQueryService.summarizeAnalysisRuns` | `200` |

Unsupported methods are left to Next.js method handling. There is no GraphQL,
RPC, offset pagination, bulk delete, or implicit cascade endpoint.

## Request contracts

Unknown properties, duplicate query parameters, invalid runtime types, empty
identifiers, unsafe identifier characters, and unsupported values are rejected.
JSON bodies are limited to 16 KiB.

### Run analysis

```json
{
  "fixtureId": "complete",
  "creatorId": "creator_fixture_complete",
  "channelId": "channel_fixture_complete",
  "correlationId": "optional_correlation",
  "analysisRunId": "optional_analysis_run"
}
```

Only a `fixtureId` from the internal allowlist is accepted. The supplied creator
and channel must match the selected fixture. Raw channel data, provider objects,
credentials, arbitrary metadata, and constructed domain entities are rejected.

Allowlisted fixtures in v1:

- `complete`
- `partial`
- `noVideos`
- `invalidMetrics` (controlled adapter-failure scenario)
- `unknownFields` (controlled partial/warning scenario)

The allowlist is internal implementation data, not uploaded client data.

### Replay

```json
{
  "fixtureId": "complete",
  "correlationId": "optional_override",
  "newAnalysisRunId": "optional_new_run"
}
```

The original run supplies creator, channel, correlation default, attempt, and
retry lineage. The fixture must be supplied again because raw source data is not
persisted. Replay always creates a new run and never overwrites the original.

### List and status summary

The list supports:

- required `channelId`;
- optional `creatorId`, `status`, `from`, `to`, `attempt`, `analysisId`;
- optional opaque `cursor`;
- optional `limit` from 1 to 100.

`from` and `to` must be canonical ISO 8601 UTC timestamps. Supported status
values are `pending`, `processing`, `completed`, `partial`, and `failed`.
`partial` is derived by the Core read layer from a completed run with adapter
warnings; it is not a new persistence status.

Status summary accepts the same filters but not `cursor` or `limit`. The current
repository boundary requires `channelId` for both operations.

### Delete

Optimistic concurrency is optional and explicit:

```text
DELETE /analysis-runs/:analysisRunId?expectedRevision=3
```

The API returns only the deleted identifier and revision. It does not expose the
deleted persistence entity and does not delete a lineage automatically.

## Response envelopes

Success:

```json
{
  "data": {},
  "meta": {
    "apiVersion": "v1",
    "requestId": "request_...",
    "timestamp": "2026-08-01T12:00:00.000Z"
  }
}
```

Failure:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request is invalid.",
    "details": [
      {
        "path": "$.channelId",
        "code": "INVALID_VALUE",
        "message": "channelId has an invalid format."
      }
    ]
  },
  "meta": {
    "apiVersion": "v1",
    "requestId": "request_...",
    "timestamp": "2026-08-01T12:00:00.000Z"
  }
}
```

Responses use `Cache-Control: no-store`. Request IDs and time are injectable for
deterministic tests. Error messages never copy unexpected exception messages,
SQL, Prisma details, connection strings, stack traces, or raw source data.

## Error and status mapping

| HTTP | Stable code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_JSON` | Empty, unreadable, or malformed JSON |
| `400` | `INVALID_REQUEST` | Runtime validation or cursor/query failure |
| `404` | `FIXTURE_NOT_FOUND` | Fixture is outside the allowlist |
| `404` | `ANALYSIS_NOT_FOUND` | Analysis run does not exist |
| `409` | `DUPLICATE_ANALYSIS_RUN_ID` | Explicit run ID already exists |
| `409` | `CONCURRENCY_CONFLICT` | `expectedRevision` is stale |
| `413` | `PAYLOAD_TOO_LARGE` | JSON body exceeds 16 KiB |
| `422` | `FIXTURE_IDENTITY_MISMATCH` | Request identity differs from fixture |
| `422` | `ANALYSIS_ADAPTER_FAILED` | Controlled fixture cannot normalize |
| `422` | `ANALYSIS_PIPELINE_FAILED` | Analysis pipeline rejects input |
| `500` | `ANALYSIS_PERSISTENCE_FAILED` | Repository/persistence operation fails |
| `500` | `INTERNAL_ERROR` | Unexpected transport dependency failure |

The API does not claim `503` because the current typed Core errors do not safely
distinguish database unavailability from other persistence failures.

## Server-only and security posture

- Route Handlers explicitly use the Node.js runtime and dynamic execution.
- `DATABASE_URL` is resolved lazily in `runtime.ts` and never enters responses.
- Prisma is created by the existing Core Composition Root, not by handlers.
- The process-local runtime is reused instead of creating a client per request.
- Tests can close the runtime explicitly.
- No client component imports the server composition boundary.

This API has no authentication or authorization in v1. It must remain behind a
trusted internal boundary. Future authentication should wrap Route Handlers
without changing AnalysisService, AnalysisQueryService, or their contracts. No
hardcoded secret header or fictional user model is provided.

## Testing

Unit and contract tests invoke the transport directly and verify route exports,
runtime validation, error mapping, response shapes, cursor opacity, and absence
of secrets or infrastructure objects.

PostgreSQL integration tests exercise:

```text
HTTP transport / Next.js Route Handler
  -> application services
  -> Prisma repository
  -> isolated creatoros_test database
  -> HTTP response
```

Use only the approved isolated `TEST_DATABASE_URL`. Never point the destructive
integration suite at the application database. The test harness rejects a URL
equal to `DATABASE_URL` and requires a database name containing `test`.

```text
pnpm --filter blueprint test
pnpm --filter blueprint test:postgres
pnpm --filter blueprint check-types
pnpm --filter blueprint lint
pnpm --filter blueprint build
```

## V1 limitations

- Internal fixtures only; no YouTube, OAuth, OpenAI, or arbitrary uploads.
- No authentication or production authorization.
- Queries are channel-scoped by the current repository boundary.
- Deleted history ancestors cannot be reconstructed from raw source data.
- No rate limiting, caching, queues, background jobs, public SDK, or UI.

The future Blueprint frontend should consume only the documented envelopes and
opaque cursors. It must not import Core persistence or server runtime modules.
