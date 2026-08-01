# Authentication Foundation

Sprint 11.0 introduced the provider-neutral identity and session foundation.
Sprint 11.1 adds a server-only Google OIDC adapter and opaque cookie transport
without adding password handling or application JWTs.

## Boundaries

```text
Future verified provider adapter
  -> AuthenticationService
       -> IdentityRepository -> UserRepository
       -> SessionService -> SessionRepository
  -> provider-neutral AuthenticationResult
```

- `identity/` owns `User`, `Identity`, validation, and repository ports. An
  identity stores a provider name and stable provider subject for lookup, but
  never stores OAuth tokens, authorization codes, or raw claims.
- `authentication/` orchestrates an identity that a future boundary has already
  verified. It rejects inactive identities and users, then asks the session
  service to create a persistent session.
- `session/` owns session lifecycle, state resolution, a repository port, and a
  closed metadata contract. Expiry, activity, and revocation remain independent
  of future transport choices such as cookies or JWTs.
- `authorization/` contains contracts only. Built-in role identifiers are
  `owner`, `admin`, and `viewer`; no permissions or policies are implemented.
- `persistence/prisma/` maps the ports to PostgreSQL. Domain code does not import
  Prisma.

## Persistence and privacy

The migration creates `users`, `identities`, and `sessions`. Foreign keys keep
identities and sessions associated with an existing user. Database checks
constrain supported locales, lifecycle states, and valid session expiration.
Session metadata accepts only a client category and optional supported locale.

The schema deliberately has no columns for passwords, password hashes, OAuth
tokens, refresh tokens, YouTube credentials, OpenAI keys, authorization headers,
or raw provider payloads.

## Extension points

1. The Google adapter verifies external evidence outside Core.
2. The application provisioner transactionally resolves or creates User and
   Identity without linking accounts by email alone.
3. `AuthenticationService` creates a session with a generated identifier,
   expiration policy, and opaque-token hash.
4. The HTTP transport places only the raw opaque session token in an HttpOnly
   cookie; the database stores only its hash.
5. Authorization policies can later implement `AuthorizationService` without
   changing authentication or persistence contracts.

Repository conformance tests run against both in-memory and Prisma adapters.
PostgreSQL tests additionally verify foreign keys, durable reads, lifecycle
updates, and the absence of secret-shaped persisted fields.
