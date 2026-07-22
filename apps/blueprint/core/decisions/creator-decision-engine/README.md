# Creator Decision Engine V1

## Purpose

The Creator Decision Engine turns normalized creator observations into a stable,
prioritized set of measurable actions. It is deterministic, platform-independent
at the domain and rule layers, and does not call external providers or AI models.

A Creator Decision is not a generic recommendation. It records the observation,
interpretation, proposed action, expected impact, evidence, confidence factors,
secondary alternatives, and metrics required to verify the action.

## Pipeline

```text
Platform analytics
  -> platform adapter
  -> normalized CreatorSignal[]
  -> normalized CreatorInsight[]
  -> deterministic DecisionRule[]
  -> confidence calculation
  -> deterministic prioritization and deduplication
  -> CreatorDecision[]
```

The YouTube adapter is the first connector. It consumes the existing
`YouTubeIntelligenceOutput` and Creator Intelligence interpretation. No
YouTube-specific field appears in the decision domain. Platform information is
kept in optional source metadata.

## Domain definitions

- `CreatorSignal`: an observable, normalized fact with a dimension, direction,
  magnitude, confidence hint, sample information, evidence, and related entity
  identifiers.
- `CreatorInsight`: a meaningful interpretation of one or more normalized
  signals. It preserves source signal identifiers and limitations.
- `DecisionEvidence`: a traceable signal, metric, comparison, sample, or quality
  value supporting a decision.
- `CreatorDecision`: a proposed action with reasoning, priority, confidence,
  alternatives, evidence, and measurable metrics.
- `DecisionMessage`: a localization key, English fallback, and parameters. The
  Core remains usable before a UI translation layer is added and does not embed
  visible copy in JSX.

All scores use the inclusive range `0..1`. Runtime validators reject invalid
inputs and invalid generated decisions without adding a validation dependency.

The root Core exports the decision-domain insight as `DecisionCreatorInsight`
because Sprint 6 already exposes a YouTube interpretation type named
`CreatorInsight`. The module-local public API retains the platform-independent
`CreatorInsight` name.

## Registered rules

V1 registers four rules:

1. `decision-rule.low-click-through`: requires a negative normalized
   click-through signal and at least four eligible observations. The metric is
   evaluated against the creator's source median.
2. `decision-rule.strong-reach-weak-retention`: requires positive reach and
   negative retention signals that overlap on at least one content entity. It
   does not infer a relationship from separate content sets.
3. `decision-rule.publishing-inconsistency`: requires a negative publishing
   consistency signal and a sufficient sample. It uses observed interval
   variation and median interval values.
4. `decision-rule.high-performing-pattern`: requires exceptional relative reach
   plus a deterministic content-pattern signal with recurring tags and related
   entity overlap. It proposes one validation item before a series and does not
   claim causation.

Rules implement `DecisionRule`, declare stable identifiers and required
dimensions, and return `null` when evidence is insufficient. Add a rule by:

1. implementing `DecisionRule` under `rules/`;
2. documenting required normalized dimensions and evidence;
3. adding it to `DEFAULT_CREATOR_DECISION_RULES`;
4. adding rule, insufficient-evidence, and integration tests.

## Confidence

Confidence is a weighted deterministic score:

```text
0.25 * data availability
+ 0.20 * sample size
+ 0.20 * supporting-signal consistency
+ 0.15 * data recency
+ 0.20 * deviation strength
```

Sample size reaches its full factor score at eight observations. Recency bands
are 30, 90, 180, and 365 days. A missing analysis period receives a neutral
recency factor of `0.5`; invalid or future periods receive `0`. Missing signals,
small samples, and partial fields lower confidence. Levels are:

- high: `>= 0.75`;
- medium: `>= 0.50` and `< 0.75`;
- low: `< 0.50`.

The returned explanation explicitly states that confidence does not imply
certainty. All weights and boundaries live in `configuration.ts`.

## Prioritization

Priority is relative and does not estimate money:

```text
0.35 * estimated impact
+ 0.30 * confidence
+ 0.15 * urgency
+ 0.10 * inverse effort
+ 0.10 * strategic relevance
```

High priority starts at `0.72`, medium at `0.48`. The prioritizer first sorts by
score, confidence, rule ID, and decision ID. It then suppresses candidates with
the same explicit deduplication key, keeping the stronger candidate. This also
provides stable ordering for ties.

Impact is derived from the magnitude of the supporting normalized signals.
Urgency, effort, and strategic-relevance heuristics are centralized per rule in
`configuration.ts`; they are relative planning inputs, not universal facts.

## Public integration

- `generateCreatorDecisions(input)` accepts platform-independent normalized
  input.
- `adaptYouTubeIntelligenceToDecisionInput(analytics, intelligence)` exposes the
  adapter independently for testing and future orchestration.
- `generateCreatorDecisionsFromYouTubeAnalytics(result)` is the smallest safe
  integration with the existing application. It invokes the existing Creator
  Intelligence interpreter, adapts the result, and returns structured decisions.

Existing analyzers, pages, runtime registrations, and legacy recommendation
contracts are unchanged.

## Adding a future platform adapter

1. Keep source-specific types and vocabulary inside `adapters/`.
2. Implement `SignalExtractor<TSource>` and map only supported observations.
3. Preserve missing values; do not replace absent metrics with zero.
4. Normalize magnitude and confidence into `0..1` using documented source
   evidence.
5. Emit stable signal IDs, evidence references, related entity IDs, and analysis
   timestamps.
6. Reuse the same rules only when the normalized semantics truly match.

## Known V1 limitations

- Growth slowdown is intentionally not implemented because the current
  analytics contract explicitly lacks subscriber history.
- Monetization decisions are not implemented because no monetization data is
  available.
- Rule assessment values are documented relative heuristics, not financial
  forecasts.
- Default messages are English fallbacks; a future decision UI must add keys to
  all four Blueprint dictionaries before rendering them.
- Decisions are generated in memory and are not persisted or accepted/dismissed
  through a workflow yet.
- The repository has a global ADR convention, but Sprint scope permits changes
  only inside `apps/blueprint`; this module document records the local decision
  without modifying global documentation.
