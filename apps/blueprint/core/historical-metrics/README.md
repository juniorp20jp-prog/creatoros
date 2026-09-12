# Historical Metrics Foundation

Sprint 11.8 introduces the canonical, provider-neutral record of metrics observed during synchronization. Current `YouTubeChannel` and `YouTubeVideo` rows remain mutable current state; observation rows are append-only evidence of what the provider returned at a particular time.

## Flow

`YouTube synchronization -> synchronization transaction -> observation batch -> historical repository -> query/trend services -> authenticated API -> Analyzer`

Completed, partial, and provider-observed no-change synchronizations create a batch in the same transaction as their sync audit. Failed synchronizations create no metric observations. Each batch contains provenance, coverage, availability, and one channel observation plus the video observations that were actually returned. A video absent from the current 50-video window is not treated as deleted.

## Precision and trends

Provider counters remain decimal strings at domain boundaries and `DECIMAL(20,0)` in PostgreSQL. Trend arithmetic uses `bigint`; any result requiring unsafe JavaScript numeric conversion is returned as unavailable. Absolute/relative delta and velocity require two time-distinct samples. Acceleration requires at least three valid samples. Results describe temporal correlation only and never causal attribution.

## History boundary

No backfill is performed. Pre-Sprint-11.8 history is unknown. The `baseline-from-current-state` provenance exists for an explicitly controlled future bootstrap, but this migration does not fabricate daily or weekly observations.

## Ownership and lifecycle

All reads derive `userId` from the authenticated CreatorOS session. Repository queries include that owner boundary, and a known foreign video ID resolves as not found. The retention contract identifies future revoke, disconnect, user-delete, and policy-expiration handling; Sprint 11.8 deliberately adds no scheduler, queue, worker, or automatic deletion.

## Public API

- `GET /api/youtube/metrics/channel/history`
- `GET /api/youtube/metrics/videos/{videoId}/history`
- `GET /api/youtube/metrics/trends?period=30d`

All endpoints are authenticated, `no-store`, bounded, and expose public read models rather than Prisma rows, raw provider payloads, ETags, sync IDs, or secrets.
