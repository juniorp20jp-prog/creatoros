# YouTube OAuth HTTP Composition

The four server-only routes are:

- `GET /api/youtube/connect`
- `GET /api/youtube/callback`
- `GET /api/youtube/status`
- `POST /api/youtube/disconnect`

Every route requires an active CreatorOS session. Connect creates random state,
nonce and PKCE S256 values. Only an opaque single-use handle is placed in an
HttpOnly, SameSite=Lax, path-limited cookie; the transaction expires after ten
minutes and is shared only within the current Node.js process.

The callback uses `openid-client` to validate state, nonce, PKCE and ID-token
claims. It performs one `channels.list?mine=true` identity lookup to resolve the
authorized channel. It does not read videos or start synchronization. Provider
tokens are normalized immediately; authorization codes, ID tokens and complete
Google responses are discarded.

`AesGcmYouTubeTokenProtector` uses randomized AES-256-GCM envelopes with
authenticated metadata and an explicit key id. `YOUTUBE_TOKEN_ENCRYPTION_KEY`
must be supplied by a secret manager and must not equal source-controlled
placeholders. A keyring can retain previous keys while new writes use the active
`YOUTUBE_TOKEN_ENCRYPTION_KEY_ID`.

## Operational limits

- The transient state store is process-local; multi-instance deployment needs
  a shared single-use store or a reviewed signed-state design.
- There is no automatic refresh scheduler. Refresh is an explicit service
  operation for future consumers.
- No YouTube UI, synchronization, analytics or background jobs are included.
- Real Google/YouTube authorization requires registering
  `/api/youtube/callback` as an OAuth redirect URI and enabling YouTube Data API
  for the deployment project.
