# Channel Data Adapter Foundation

Channel Data Adapters are the official ingress boundary between
source-specific data and the provider-neutral `RawChannelData` contract used by
the Creator Intelligence Engine.

Adapters validate and translate data. They do not calculate metrics, scores,
opportunities, recommendations, or user-facing analysis.

## Boundary

```text
Source-specific data
  -> ChannelDataAdapter<TSource>
  -> ChannelDataAdapterResult
  -> RawChannelData
  -> CreatorIntelligenceAnalysisPipeline
  -> AnalysisResult
```

The pipeline never imports a fixture or provider source model. A source adapter
may know both its source schema and `RawChannelData`, but must not import score,
opportunity, or recommendation implementations.

## Contract

Every adapter implements:

```ts
interface ChannelDataAdapter<TSource> {
  readonly definition: {
    adapterId: string;
    adapterVersion: string;
    sourceType: string;
    supportedSchemaVersion: string;
  };

  adapt(source: TSource): ChannelDataAdapterResult;
}
```

Results are discriminated:

- `success`: valid `rawChannelData`, no errors or warnings.
- `partial`: valid `rawChannelData` plus typed warnings.
- `failure`: typed errors and no `rawChannelData`.

All results include adapter metadata and a processing timestamp supplied by the
shared injectable `Clock`.

## Errors and warnings

Errors stop integration before the analysis pipeline. Current error codes
cover:

- invalid root structures and field types;
- missing required fields;
- empty identifiers;
- inconsistent creator and channel identities;
- negative and non-finite numbers;
- invalid dates;
- duplicate video identifiers;
- unsupported source schema versions.

Warnings allow the pipeline to continue with explicit partial data:

- `MISSING_OPTIONAL_FIELD`
- `UNKNOWN_FIELD_IGNORED`

Invalid values are never clamped, converted, or replaced. Missing optional
metrics remain `undefined`; unknown source fields never cross into
`RawChannelData`.

## Fixture adapter

`FixtureChannelDataAdapter` parses untrusted `unknown` input against the local
fixture schema. It exists for deterministic development and tests only.

Available fixtures:

- `complete`
- `partial`
- `noVideos`
- `invalidMetrics`
- `unknownFields`

They contain synthetic identifiers and no real personal information.

Fixture limitations:

- no network access;
- no provider authentication;
- no pagination or rate limits;
- no provider response semantics;
- one source schema version;
- no persistence;
- no simulation of live data freshness.

The fixture adapter is not a YouTube adapter and must not be described as one.

## Versioning

Adapter and source schema versions are separate:

- `adapterVersion` changes when adapter behavior or mapping changes.
- `supportedSchemaVersion` identifies the exact source schema accepted.

The initial strategy is deliberately small:

1. Reject unsupported schema versions with
   `UNSUPPORTED_SCHEMA_VERSION`.
2. Add an explicit parser or migration function when a new source schema is
   approved.
3. Test old and new schemas independently.
4. Increment `adapterVersion` when mapping behavior changes.

Adapters must not silently reinterpret an unknown version.

## Integration

`executeAdaptedChannelAnalysis` performs the explicit end-to-end flow:

1. Execute the adapter.
2. Stop when the adapter returns `failure`.
3. Continue when it returns `success` or `partial`.
4. Send only `RawChannelData` to the analysis pipeline.
5. Return the adapter result, analysis, and completed pipeline steps.

The helper accepts both adapter and pipeline instances, preserving dependency
injection and testability.

## Adding a future adapter

1. Define the source schema in an adapter-owned module.
2. Implement `ChannelDataAdapter<TSource>`.
3. Declare stable adapter and schema metadata.
4. Parse untrusted input without `any`.
5. Reject critical structural problems.
6. Return warnings for accepted partial data.
7. Map only validated fields to `RawChannelData`.
8. Inject `Clock`; do not call `Date.now()` directly.
9. Add deterministic contract and integration tests.
10. Verify there is no analysis, network, credential, or UI dependency.

## Privacy

Adapters should request and retain only fields needed by the domain contract.
Secrets, access tokens, raw credentials, private provider metadata, and
unnecessary personal information must never be copied into `RawChannelData`,
errors, warnings, logs, or fixtures.
