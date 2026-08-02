# YouTube Authorization Foundation

This module owns provider-neutral YouTube connection state. It does not fetch
videos, synchronize channels, run analysis, or expose credentials to UI code.

## Flow and responsibilities

1. The server OAuth adapter verifies the Google callback and produces a
   normalized `VerifiedYouTubeGrant`.
2. `YouTubeAuthorizationService` validates the required read-only scope,
   protects credentials, and coordinates atomic persistence.
3. `YouTubeIdentityRepository` exposes safe channel identity data.
4. `YouTubeTokenRepository` exposes encrypted token records only.
5. `YouTubeAuthorizationRepository` combines both contracts for atomic connect,
   reconnect, and revoke operations.

Refresh and revocation are provider ports. The service temporarily reveals only
the required refresh token, calls the injected provider, and immediately
re-protects rotated credentials. Public connection status never contains token
material.

## Security boundaries

- Authorization codes and complete provider responses are never accepted by
  Core persistence contracts.
- Refresh and optional access tokens must be encrypted before repository calls.
- Channel ownership is unique across CreatorOS users.
- Disconnect revokes the provider grant before atomically deleting local token
  rows and marking the identity revoked.
- The encryption key id is persisted separately to support future key rotation.

The V1 scope is `youtube.readonly`. Additional scopes require a reviewed domain
change; callers must not append scopes dynamically.
