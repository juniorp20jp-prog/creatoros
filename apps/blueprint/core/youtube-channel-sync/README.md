# YouTube Channel Synchronization

This module synchronizes only the authenticated channel resource. It does not
request playlists, videos, analytics, comments, or derived metrics.

The service obtains an encrypted access token through the authorization
foundation, refreshes it when expired or after one unauthorized response, then
calls the provider-neutral `YouTubeApiAdapter`. A successful snapshot is
validated, compared field-by-field, and persisted with an audit record in one
transaction. Matching ETags or identical snapshots produce a `no-change`
audit record and do not rewrite channel metadata.

Counts remain decimal strings in Core to preserve YouTube unsigned-long values
without JavaScript precision loss. Optional fields remain absent rather than
being invented. A handle is recorded only when the official `customUrl` value
is supplied in `@handle` form.

Every provider failure is reduced to a stable safe code. Tokens, authorization
codes, claims, and complete provider responses never enter these contracts.
