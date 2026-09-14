# YouTube Analytics readonly integration

This module models Analytics as an optional capability beside the existing
YouTube Data API connection. It never treats a connected channel as proof that
private Analytics is authorized.

The application flow is `CreatorOS session -> capability guard -> existing
YouTube authorization service -> Analytics adapter -> collection service ->
historical repository`. Provider responses are normalized before entering the
Core. The adapter queries `channel==MINE`, caps backfill at 90 days, groups the
managed-video window (maximum 50 IDs), and resolves every value by its
`columnHeaders` name.

Each collection creates a new `youtube-analytics-query` observation batch.
Daily channel and video rows are immutable; later collections never update old
evidence. Read projections select the newest batch for each date/entity and
metric. Missing metrics remain absent, while an explicit provider zero remains
zero. `effectiveDataThrough` communicates YouTube processing latency.

Only `yt-analytics.readonly` is added incrementally. The existing
`youtube.readonly` scope and encrypted refresh token are preserved. Decline,
revocation, or temporary Analytics failure does not disconnect the Data API or
delete prior evidence. Monetary scope, revenue, impressions, and thumbnail CTR
are intentionally outside V1.

## Contracts and calculations

- Supported periods are closed calendar windows of 7, 30, or 90 UTC days.
- Additive metrics (`views`, watch minutes, subscriber movement, likes,
  comments, and shares) are summed with decimal-string arithmetic; values are
  never routed through JavaScript `Number`.
- Daily `averageViewDuration` and `averageViewPercentage` observations use a
  deterministic arithmetic mean rounded to six additional decimal places.
- `netSubscribers` exists only when both gained and lost values exist and is
  calculated as gained minus lost.
- A missing metric remains absent. A provider value of zero remains zero.
- When two immutable batches cover the same date, the projection selects the
  newest available value independently for each metric. A newer partial batch
  therefore cannot erase an older valid metric.

## Capability and failure behavior

The capability states are `not-authorized`, `authorized`, `declined`,
`revoked`, and `temporarily-unavailable`. Collection is never required for the
existing Data API path. Provider failures create a failed observation batch
with zero metric rows for auditability; no metric value is fabricated and
previous observations remain intact. A runtime service also rejects overlapping
collections for the same user.

The authenticated HTTP surface is:

- `GET /api/youtube/analytics/status`
- `GET /api/youtube/analytics/connect`
- `POST /api/youtube/analytics/sync?period=7d|30d|90d`
- `GET /api/youtube/analytics/channel?period=7d|30d|90d`
- `GET /api/youtube/analytics/videos?period=7d|30d|90d`

All read and collection responses are `no-store`, use the authenticated
CreatorOS owner, and omit credentials, raw provider payloads, and internal user
identifiers.

## V1 limits

V1 queries only the existing managed window of at most 50 owned videos and
never requests more than 90 days. It uses grouped `reports.query` requests, not
one request per video. YouTube processing latency is represented through
`effectiveDataThrough` and freshness instead of converting unavailable recent
days into zero. Cross-process scheduling, distributed locking, monetary
analytics, CTR, impressions, and automated background refresh are intentionally
deferred.
