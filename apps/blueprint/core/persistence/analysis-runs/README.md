# Analysis Run Persistence

This module defines the storage-agnostic boundary for one CreatorOS analysis
execution. `CreatorAnalysisRun` aggregates the existing YouTube Intelligence,
Creator Intelligence, and Creator Decision contracts; it does not duplicate or
change their domain behavior.

## Record policy

- `CreatorAnalysisRunRecord` is the persistence-safe V1 representation.
- `CREATOR_ANALYSIS_RUN_SCHEMA_VERSION` is the single source of truth for the
  current schema version.
- Top-level run timestamps are canonical ISO 8601 UTC strings produced by
  `Date#toISOString`. Dates inside domain snapshots retain the canonical domain
  format accepted by their existing validators.
- Records may contain only finite numbers, strings, booleans, null, arrays, and
  plain objects. `undefined`, `Date`, `Map`, `Set`, functions, symbols, bigint,
  class instances, and circular references are rejected.
- V1 supports YouTube analysis runs. A future platform or record shape requires
  a new schema version and explicit version dispatch; unsupported future
  versions are never guessed or repaired.

## Mapping and validation

`serializeCreatorAnalysisRun` normalizes run timestamps, clones the aggregate,
and validates the resulting record. `deserializeCreatorAnalysisRun` returns a
discriminated result and never mutates the persisted value. The parser validates
the record envelope, storage safety, execution metadata, YouTube input, analysis
result, Creator Intelligence result, decisions, and cross-field identities.

## Repository semantics

`CreatorAnalysisRunRepository` is asynchronous so database adapters can
implement it without changing consumers. `save` is an upsert by record ID.
`findById` returns `null` when no record exists. `listRecent` sorts by `updatedAt`
descending, then `createdAt` descending, then ID ascending. Implementations must
return defensive copies.

`InMemoryCreatorAnalysisRunRepository` is the only Sprint 9 implementation. It
has instance-local state, validates every saved record, and copies at ingress
and egress. It is intended for deterministic tests and architecture validation,
not production storage.

## Future adapters

A database adapter should implement `CreatorAnalysisRunRepository`, persist the
record without changing its shape, enforce the same parser at its boundary, and
dispatch migrations by `schemaVersion` before deserialization. Secrets and
provider credentials must never enter the record.

Sprint 9 intentionally adds no database, API, authentication, background job,
browser storage, or UI integration.
