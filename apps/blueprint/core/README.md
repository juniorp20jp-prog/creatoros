# CreatorOS Core Architecture

The `core` directory contains the framework-independent contracts and runtime
used by CreatorOS intelligence engines. It must not depend on React, Next.js,
CSS, or translated interface copy.

## Structure

```text
core/
  domain/       Business models shared by engines
  engines/      Engine implementations and the typed engine registry
  interfaces/   Public engine and AI provider contracts
  intelligence/ Pure interpreters that turn engine output into explainable domain results
  pipeline/     Reusable sequential AI pipeline
  persistence/  Storage-agnostic analysis-run records and repositories
  providers/    AI provider registration and lookup
  services/     Execution context, runtime, and result factories
  types/        Cross-cutting execution contracts
  utilities/    Small dependency-free validation helpers
  runtime.ts    Composition root for registered CreatorOS engines
  index.ts      Public Core API
```

## Data flow

```text
Caller
  -> EngineRuntime
  -> ExecutionContextFactory
  -> EngineRegistry
  -> IntelligenceEngine
  -> AiPipeline
  -> Pipeline steps / AI providers (future)
  -> EngineExecutionResult
  -> Caller
```

1. A caller sends typed input to the `EngineRuntime`.
2. The runtime creates an execution context with identifiers, timestamps,
   locale, correlation data, and immutable attributes.
3. The typed registry resolves the requested engine.
4. The engine validates domain input and creates its initial pipeline state.
5. Pipeline steps progressively enrich the state. Future steps may use an AI
   provider obtained from `ProviderRegistry`.
6. Every execution returns a discriminated result with either `output` or an
   `error`, plus common execution metadata.

The Dashboard and other UI layers consume Core results, but Core never imports
presentation components or localization dictionaries.

## Responsibilities

### Domain

Defines stable CreatorOS concepts such as creator context, objectives,
intelligence sources, signals, and recommendations. Domain models contain no
framework behavior.

### Interfaces

Defines the public contracts implemented by intelligence engines and external
AI providers. Consumers should depend on these contracts instead of concrete
classes whenever possible.

### Engine registry

Maps stable engine identifiers to strongly typed input and output contracts.
Duplicate registrations and unresolved engine identifiers fail immediately.
The registry is the source of truth for available Core engines.

### Engine runtime

Centralizes execution context creation and engine resolution. Callers should
use the runtime or a public engine function instead of invoking engine classes
directly.

### AI pipeline

Runs ordered, asynchronous steps over a typed state. Steps own one bounded
transformation and return the next immutable state. The initial Creator
Intelligence pipeline intentionally has no analysis steps yet.

### Providers

Encapsulates future model vendors and AI services behind `AiProvider`. Provider
implementations must translate vendor-specific requests and responses at their
boundary so engine contracts remain vendor-neutral.

### Shared services

Own cross-cutting execution behavior: clocks, identifier generation, context
creation, result metadata, and runtime orchestration. Engines must not duplicate
these concerns.

### Persistence

Defines the versioned, storage-safe `CreatorAnalysisRunRecord`, mapping and
validation boundaries, and an asynchronous repository contract. The initial
in-memory repository uses defensive copies and exists only for deterministic
tests and architecture validation. Core does not select or connect a database.

## Creator Intelligence Engine

The first registered engine is `creator-intelligence`.

Current responsibilities:

- Accept a strongly typed creator context, optional objective, and sources.
- Validate required identifiers.
- Produce a typed execution result.
- Report whether it is awaiting sources or ready for provider-backed steps.
- Optionally normalize explicit provider-neutral channel data.
- Calculate deterministic metrics, scores, opportunities, and recommendations.
- Expose stable metadata, capabilities, and version information.

It does not fetch or analyze YouTube provider payloads and does not call an AI
provider. Without `rawChannelData`, empty signals and recommendations preserve
the original orchestration contract. With `rawChannelData`, the deterministic
analysis result is exposed separately through `output.analysis`.

The analysis architecture, domain models, formulas, extension contracts, and
limitations are documented in
`engines/creator-intelligence/README.md`.

```ts
import { executeCreatorIntelligence } from "./core";

const result = await executeCreatorIntelligence(
  {
    creator: {
      creatorId: "creator_123",
      locale: "es",
      channels: [],
    },
    sources: [],
  },
  {
    locale: "es",
    correlationId: "request_123",
  },
);

if (result.status === "completed") {
  console.log(result.output.readiness);
}
```

## YouTube Intelligence Engine

The registered `youtube-intelligence` engine performs deterministic analysis
over normalized channel and video input. It calls no external API or AI
provider and returns no recommendations. Its complete contracts, formulas,
thresholds, validation rules, signal catalog, and V1 limitations are documented
in `engines/youtube-intelligence/README.md`.

## Creator Intelligence Interpreter

The pure `Creator Intelligence Interpreter` transforms a public YouTube
Intelligence execution result into a structured Executive Brief, prioritized
insights, evidence, context, and quality limitations. It is deliberately
separate from the registered `creator-intelligence` orchestration engine and
does not alter YouTube formulas or call AI providers. Its contracts, traceability,
priority rules, and limitations are documented in
`intelligence/creator-intelligence/README.md`.

## Conventions

- Engine IDs and routes use stable `kebab-case` identifiers.
- Type and class names use `PascalCase`; functions and values use `camelCase`.
- Engine inputs and outputs are explicit types, never `any`.
- Visible copy belongs to localization dictionaries, not Core results.
- Domain status values use stable codes that presentation layers translate.
- Inputs and outputs use readonly collections at public boundaries.
- Engines return `EngineExecutionResult`; they do not throw expected execution
  failures to callers.
- Provider-specific types stay inside provider implementations.
- Pipeline steps are small, ordered, and independently testable.
- New shared behavior belongs in a service only when two or more engines need
  the same responsibility.

## Adding a new engine

1. Create `core/engines/<engine-id>/` with its input, output, state, class, and
   public exports.
2. Implement `IntelligenceEngine<TId, TInput, TOutput>`.
3. Define a stable engine ID, version, and capability list.
4. Add its input/output contract to `CoreEngineContracts` in `runtime.ts`.
5. Register one engine instance in the Core composition root.
6. Add a public execution function that delegates to `coreEngineRuntime`.
7. Add pipeline steps only for real approved behavior.
8. Add deterministic tests for validation, calculations, registration, and
   execution failures.
9. Run Blueprint type checking, linting, and production build.

Adding an engine must not require changes to existing engine implementations.
Only the central contract map and composition root are extended.

## Adding an AI provider

1. Implement `AiProvider<TRequest, TResponse>` in a provider-specific module.
2. Give it a stable identifier and capability list.
3. Translate vendor payloads at the provider boundary.
4. Register the provider with `ProviderRegistry`.
5. Inject the registry into the pipeline step that needs that capability.
6. Record provider identifiers in execution metadata.

Secrets and environment access must remain inside provider infrastructure and
must never be stored in domain models, pipeline state, or Dashboard data.
