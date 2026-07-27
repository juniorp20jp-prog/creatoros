# Creator Intelligence Engine Foundation

The registered `creator-intelligence` engine is the provider-neutral analysis
orchestrator for CreatorOS. Sprint 10.0 adds a deterministic channel-analysis
path without connecting YouTube, an AI provider, a database, or any external
API.

## Compatibility

The original engine input remains valid:

```ts
{
  creator,
  objective?,
  sources,
}
```

When `rawChannelData` is absent, the engine preserves the existing
`awaiting-sources` and `ready-for-providers` behavior. When it is present, the
engine executes the analysis pipeline and returns `analysis-completed` with an
`AnalysisResult`.

## Architecture

```text
RawChannelData
  -> ChannelDataNormalizer
  -> NormalizedChannelData
  -> ChannelMetricsCalculator
  -> ChannelMetrics
  -> ScoreEngine
  -> OpportunityEngine
  -> provisional AnalysisResult
  -> RecommendationEngine
  -> final AnalysisResult
```

`CreatorIntelligenceAnalysisPipeline` owns only orchestration. Each stage is an
interface injected through the constructor:

- `ChannelDataNormalizer`
- `ChannelMetricsCalculator`
- `ScoreEngine`
- `OpportunityEngine`
- `RecommendationEngine`

Alternative implementations can replace one stage without changing the
pipeline, runtime, registry, or public result.

## Domain models

- `CreatorProfile`: stable creator identity and optional locale information.
- `ChannelProfile`: provider-independent channel identity and descriptive data.
- `VideoMetrics`: observed metrics for one supplied video.
- `ChannelMetrics`: deterministic aggregates calculated from supplied data.
- `AnalysisScore`: a score, availability status, and numeric evidence.
- `GrowthOpportunity`: an evidence-backed condition detected in metrics.
- `Recommendation`: a stable action and rationale code derived from an
  opportunity.
- `AnalysisResult`: complete immutable output of the pipeline.

Raw contracts accept nullable optional values so adapters can preserve missing
data. Normalization converts present values into the domain model and never
replaces absent optional metrics with fabricated numbers.

## Validation and normalization

The default normalizer:

- trims required identifiers and optional text;
- canonicalizes dates to ISO 8601 UTC;
- rejects invalid or future video dates;
- rejects negative or non-finite metrics;
- rejects duplicate video identifiers;
- requires creator and channel identities to agree;
- preserves unavailable optional values as unavailable.

Provider-specific payload translation belongs before `RawChannelData`.

## Metrics

The metrics calculator currently derives:

- analyzed video and view totals;
- average views per analyzed video;
- weighted engagement rate from videos with views and at least one interaction
  metric;
- average publishing interval in days;
- publishing-interval coefficient of variation;
- average-view reach relative to subscriber count;
- optional-field data completeness.

Formulas:

```text
average views = analyzed views / analyzed videos
engagement rate = (likes + comments) / eligible views * 100
average interval = sum(interval days) / interval count
interval variation = standard deviation(intervals) / average interval
subscriber reach = average views / subscribers * 100
data completeness = available optional fields / expected optional fields
```

If a formula cannot be supported by the supplied data, its value remains
unavailable.

## Scores

The default Score Engine returns values in the inclusive `0..100` range:

- Content Score compares observed engagement with the centralized foundation
  target.
- Consistency Score converts publishing-interval variation into a relative
  stability score.
- Optimization Score represents data completeness.
- Growth Score compares average-view reach with the centralized foundation
  target.

An unavailable score has `availability: "insufficient-data"`, value `0`, and
no evidence. The zero is a transport value and must not be presented as an
observed performance score.

Thresholds live in `score-engine.ts` and are foundation defaults, not universal
industry claims.

## Opportunities and recommendations

`DefaultOpportunityEngine` accepts only `ChannelMetrics`. It emits an
opportunity only when a documented threshold is crossed and includes the exact
metric evidence.

`DefaultRecommendationEngine` accepts an `AnalysisResult` and maps its
opportunities to stable action and rationale codes. It does not generate prose,
predictions, causal claims, or recommendations without evidence.

Presentation layers must localize the codes.

## Extensibility

To replace or extend a stage:

1. Implement the corresponding interface.
2. Keep provider-specific contracts outside the domain models.
3. Inject the implementation into `CreatorIntelligenceAnalysisPipeline`.
4. Add deterministic contract tests.
5. Record new stable pipeline step identifiers if orchestration changes.

External providers may be introduced later behind adapters. They must not alter
the domain contracts or access UI concerns.

## Limitations

This foundation:

- does not fetch channel data;
- does not know YouTube response formats;
- does not call OpenAI or another AI provider;
- does not predict future performance;
- does not infer topics, audience intent, or causality;
- uses intentionally simple scoring thresholds;
- has no persistence responsibility;
- returns stable codes rather than user-facing copy.

Every result includes
`deterministic-foundation-no-external-analysis` in `limitations` so consumers
cannot mistake this foundation for a production intelligence model.

## Example

```ts
import { executeCreatorIntelligence } from "../../index";

const result = await executeCreatorIntelligence({
  creator: {
    creatorId: "creator_123",
    channels: [],
  },
  sources: [],
  rawChannelData: {
    collectedAt: "2026-07-20T12:00:00.000Z",
    creator: {
      id: "creator_123",
    },
    channel: {
      id: "channel_123",
      creatorId: "creator_123",
      subscribers: 100,
    },
    videos: [],
  },
});
```
