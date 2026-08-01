# Google OIDC and CreatorOS Session Composition

This server-only module implements Google OpenID Connect Authorization Code
with PKCE through `openid-client` 6.8.4. Node.js 20 or newer is required; the
repository currently uses Node.js 24. Provider scopes are exactly `openid`,
`email`, and `profile`.

## Flow

`GET /api/auth/google` creates cryptographically random state, nonce, and PKCE
values. The sensitive verifier is retained in an instance-local, single-use,
ten-minute authorization-state store. Its browser cookie contains only an
opaque handle and is HttpOnly, SameSite=Lax, path-limited, and Secure in
production. `returnTo` accepts only localized Mission Control paths.

`GET /api/auth/google/callback` consumes the state before exchanging the code.
`openid-client` validates the response, issuer metadata, state, nonce, PKCE,
ID-token signature, audience, and expiration. The adapter additionally checks
the required Google claims and returns `VerifiedExternalIdentity`; tokens and
raw claims are discarded.

The application layer transactionally resolves or provisions User + Identity.
An existing email is never linked automatically to a new Google subject. The
CreatorOS session receives a random opaque token; only its SHA-256 hash is
persisted. The raw token exists only in an HttpOnly, SameSite=Lax, Secure-in-
production cookie. With `AUTH_COOKIE_SECRET`, the stored value is an
HMAC-SHA-256 digest bound to the server secret. Session resolution checks expiration, revocation, and active
user status, and touches activity at most once every five minutes.

`GET /api/auth/session` returns a safe principal or an anonymous read model.
`POST /api/auth/logout` idempotently revokes the CreatorOS session and clears
the cookie. Internal Analysis API Route Handlers require that session and use
401 for every unauthenticated state; 403 remains reserved for authorization.

## Google Cloud preparation

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth Client ID of type **Web application**.
4. Add `http://localhost:3002/api/auth/google/callback` as a local redirect URI.
5. Add production origins and redirect URIs only when the deployment URL is
   known.
6. Configure the variables documented in `.env.example`.

No YouTube scopes are requested. Google Cloud and a real Google login are not
configured or certified by this repository change.

## Security limits

The transient authorization store is instance-local and intentionally avoids a
new Redis dependency. A process restart invalidates in-flight login attempts,
and multi-instance deployment will require a shared single-use store. Cookies
are secure transport controls, not a claim of formal security compliance.
Independent threat modeling, key rotation, abuse controls, and production
security review remain required.
