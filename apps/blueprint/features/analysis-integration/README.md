# Frontend Integration Layer

This feature is the browser-facing boundary for the certified Internal Analysis
API. It keeps React isolated from transport serialization, API envelopes, Core,
Prisma, and PostgreSQL.

## Data flow

```text
UI -> hooks -> AnalysisApiClient -> Internal Analysis API -> services -> PostgreSQL
```

UI code imports the feature's public `index.ts`. It does not import server
services, persistence adapters, or Core contracts directly.

## Responsibilities

- `client/analysis-api-client.ts` serializes the seven supported API operations,
  executes HTTP requests, and returns public API models.
- `client/analysis-api-envelope.ts` validates the public success/error envelope
  before data reaches React.
- `client/analysis-api-client-error.ts` maps HTTP, transport, cancellation, and
  malformed-response failures to stable frontend error kinds and message keys.
- `hooks/` owns request lifecycle state and exposes reusable query and mutation
  hooks. It contains no persistence or domain business logic.
- `tests/` exercises the browser boundary with mock HTTP only.

## Supported operations

- Run an analysis.
- List analysis runs.
- Get analysis details.
- Get analysis history.
- Replay an analysis.
- Delete an analysis with optional optimistic revision.
- Get a status summary.

## Hook state contract

Every hook returns `data`, `error`, and one of these states:

- `idle`: no request is currently configured or started.
- `loading`: an initial request is active.
- `retry`: a retry request is active.
- `success`: a non-empty result is available.
- `empty`: the API returned a valid result with no records.
- `error`: a safe mapped error is available.
- `cancelled`: the active request was aborted.

Query hooks expose `retry` and `cancel`. Mutation hooks also expose `execute`.
Starting a newer request cancels the previous one, and stale responses cannot
replace the latest state.

## Error boundary

HTTP statuses `400`, `404`, `409`, `422`, and `500` are mapped to safe message
keys. Internal API error codes and server details remain inside the transport
boundary and are never returned by the hooks.

## Extensibility rules

Add API operations to the certified public API contracts first, then implement
their serialization in `AnalysisApiClient`. A hook may coordinate request state,
but business rules stay in the service layer. This Sprint intentionally adds no
screen, caching, external provider, or database access.
