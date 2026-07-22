# Creator Intelligence Interpreter V1

The Creator Intelligence Interpreter converts the public result of the
YouTube Intelligence Engine into a deterministic, explanatory contract. It is
not the existing `creator-intelligence` engine: that registered engine owns
future creator-context and provider orchestration, while this interpreter owns
the bounded translation from analytics to evidence-backed intelligence.

## Data flow

```text
Normalized demo fixture
  -> executeYouTubeIntelligence
  -> EngineExecutionResult<YouTubeIntelligenceOutput>
  -> interpretCreatorIntelligence
  -> CreatorIntelligenceResult
  -> workspace View Model
  -> localized React UI
```

The module imports no React, Next.js, CSS, localization dictionary, external
API, or AI provider. Consumers import `interpretCreatorIntelligence` from the
Core public API.

## Input and output

The only input is the public discriminated execution result returned by
`executeYouTubeIntelligence`. A completed compatible result produces
`CreatorIntelligenceSuccess`; an analytical validation failure, incompatible
shape, or controlled unexpected failure produces `CreatorIntelligenceFailure`.
Expected failures are returned, never thrown toward the UI.

A success contains:

- a structured Executive Brief with stable IDs, message keys, parameters,
  evidence references, status, and preserved confidence;
- sorted insights with category, priority, evidence, sample, limitations,
  source signal IDs, related video IDs, and recurring terms;
- a flat evidence catalog for cross-references;
- period, sample, channel, available-metric, quality, limitation, and source
  execution metadata.

The generation date is the analytical `analysisDate`, not the machine clock,
so fixtures and tests remain deterministic.

## Traceability and evidence

Every signal-backed insight uses `insight.youtube.<signal-code>` and keeps the
original signal code. Numeric evidence is copied exactly from
`signal.evidence`; its `sourceRef` identifies the corresponding public output
path. React formats values but does not recalculate them.

The data-quality insight is created only when the result is partial or limited.
It uses exact field, sample, exclusion, and unevaluated-signal counts. Its
confidence is `null` because the analytical engine emits no confidence for a
quality summary.

## Categories and priority

Signals map through a documented fixed table:

- `opportunity`: high relative CTR, retention, engagement, or exceptional
  relative performance;
- `risk`: concentration, inconsistency, or relatively low measured metrics;
- `pattern`: publication-frequency change or duration/performance association;
- `finding`: recurring lexical title terms;
- `data-quality`: partial or insufficient analytical evidence.

Priority is deterministic:

1. high confidence plus high impact, or a high-confidence risk, is `high`;
2. high impact, medium impact with non-low confidence, or high confidence is
   `medium`;
3. other evaluated signals are `low`;
4. limited data quality is `high`; partial data quality is `medium`.

Sorting uses priority, category, confidence, then stable ID. Category order is
`risk`, `opportunity`, `pattern`, `finding`, `data-quality`. Input order alone
never determines the final order.

## Executive Brief rules

The brief contains at most three statements. Its first statement reports the
measured sample; remaining statements reference the highest-priority supported
insights. With zero supported insights, it explicitly emits a no-evidence
message key. A limited sample always produces a limited headline.

All text is represented by message keys plus parameters. The interpreter does
not emit localized prose, causal claims, external benchmarks, predictions, or
recommendations.

## Confidence

Signal confidence is copied from the YouTube Intelligence Engine. The brief
uses the lead insight's emitted confidence. When no supported confidence
exists, the value remains `null`; it is never converted to `low`.

Confidence describes evidence availability and consistency. It is not a
probability of future success.

## Intelligence versus recommendation

An insight explains an observed analytical signal and links it to evidence. A
recommendation prescribes an action. V1 intentionally produces only insights.
No recommendation engine, strategy generator, causal model, or generative AI
is part of this module.

## Limitations and future extensions

V1 can only explain data and signals present in the YouTube Intelligence
result. It cannot infer content semantics, thumbnail quality, competitor
position, causality, future performance, or economic impact. Future domain
adapters may interpret other engine results behind separate typed boundaries;
future recommendation capabilities must consume intelligence explicitly rather
than being added implicitly to this interpreter.

```ts
import {
  executeYouTubeIntelligence,
  interpretCreatorIntelligence,
} from "./core";

const analytics = await executeYouTubeIntelligence(input);
const intelligence = interpretCreatorIntelligence(analytics);

if (intelligence.status === "success") {
  console.log(intelligence.brief.headline.messageKey);
}
```
