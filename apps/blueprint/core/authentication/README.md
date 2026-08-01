# Authentication Foundation

Sprint 11.0 introduces a provider-neutral identity and session foundation. It
contains no login UI, password handling, OAuth provider, token, cookie, or JWT
implementation.

## Boundaries

```text
Future verified provider adapter
  -> AuthenticationService
       -> IdentityRepository -> UserRepository
       -> SessionService -> SessionRepository
  -> provider-neutral AuthenticationResult
```

- `identity/` owns `User`, the internal `Identity`, validation, and repository
  ports. An identity is intentionally not an OAuth identity and stores no
  provider subject or credential.
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

1. A future provider adapter verifies external evidence outside Core.
2. It resolves that evidence to an internal `identityId`.
3. It calls `AuthenticationService.authenticateIdentity` with a generated
   session identifier and expiration policy.
4. A future HTTP transport may place only an opaque session reference in a
   cookie. That choice does not change the identity or session domain.
5. Authorization policies can later implement `AuthorizationService` without
   changing authentication or persistence contracts.

Repository conformance tests run against both in-memory and Prisma adapters.
PostgreSQL tests additionally verify foreign keys, durable reads, lifecycle
updates, and the absence of secret-shaped persisted fields.
