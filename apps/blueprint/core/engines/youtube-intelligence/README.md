# YouTube Intelligence Engine V1

`youtube-intelligence` analyzes normalized channel and video data with pure,
deterministic rules. It does not fetch YouTube data, call AI providers, use
external benchmarks, or return recommendations.

## Public API

Consumers call `executeYouTubeIntelligence` from the Core public API. The
engine is registered in `coreEngineRegistry`; callers do not need to construct
or register it.

```ts
import { executeYouTubeIntelligence } from "./core";

const result = await executeYouTubeIntelligence({
  channel: {
    id: "channel_123",
    name: "Example channel",
    subscribers: 2500,
  },
  videos: [
    {
      id: "video_123",
      title: "A measured video",
      publishedAt: "2026-06-01T12:00:00Z",
      durationSeconds: 480,
      views: 1000,
      likes: 50,
    },
  ],
  context: {
    analysisDate: "2026-07-20T12:00:00Z",
    period: {
      startDate: "2026-01-01",
      endDate: "2026-06-30T23:59:59Z",
    },
  },
});

if (result.status === "completed") {
  console.log(result.output.summary.medianViews);
}
```

## Input contract

- `channel`: required ID, name, and current subscribers. Creation date, total
  views, total videos, and language/market are optional.
- `videos`: normalized video records. ID, title, publication date, duration,
  and views are required. Likes, comments, impressions, CTR, average view
  duration, average percentage viewed, and subscribers gained are optional.
- `context`: analysis date, inclusive requested period, optional market, and
  optional CreatorOS creator objective.

CTR and `averagePercentageViewed` use percentage points in the inclusive
range `0..100`. No optional value is converted to zero or inferred from a
different metric.

## Output contract

- `context`: the original analysis context and optional objective.
- `summary`: analyzed sample, covered period, view and duration statistics,
  publication frequency, weighted engagement, subscriber impact, and view
  concentration.
- `videos`: available raw metrics, derived metrics, comparisons with the
  channel sample, and relative classification for each included video.
- `signals`: evidence-backed observations with stable codes, impact,
  categorical confidence, numeric evidence, related IDs, and a localizable
  neutral explanation descriptor.
- `dataQuality`: complete, partial, and absent fields; input/effective sample
  sizes; excluded videos; warnings; limitations; and unevaluated signals.

Historical channel growth is always `not-calculable` in V1 because the input
contains no subscriber history. `subscriberImpact` is separate and only uses
available `subscribersGained` values.

## Formulas

- Average views: `sum(views) / analyzedVideoCount`.
- Median views: middle sorted value, or the average of the two middle values.
- Average duration: `sum(durationSeconds) / analyzedVideoCount`.
- Video engagement: `(available likes + available comments) / views`; requires
  views greater than zero and at least one interaction component. A calculation
  with only one component is marked partial.
- Channel engagement: sum of available interaction components divided by the
  sum of views from eligible videos. It is not an average of video rates.
- Subscriber impact: total and average `subscribersGained` over eligible
  videos. Per-thousand impact is `total gained / eligible views * 1000`.
- Publication intervals: UTC day differences between consecutive publication
  dates. The summary returns average, median, population coefficient of
  variation, and `(videoCount - 1) * 30 / coveredDays` when calculable.
- Concentration: `topVideoShare = top views / total views` and
  `topThreeShare = sum(top three views) / total views`.
- Duration association: split videos at the sample median duration, compare
  median views of `shorter-or-equal` and `longer` groups, then calculate the
  absolute difference divided by the larger group median. It describes an
  association, never causality.

## Relative classification

The sample median is the primary reference. Multipliers live in
`thresholds.ts` and boundaries are covered by tests.

| Classification | Views / sample median |
| --- | ---: |
| `below-median` | `< 0.75` |
| `near-median` | `>= 0.75` and `< 1.25` |
| `above-median` | `>= 1.25` and `< 2.00` |
| `exceptional` | `>= 2.00` |

A one-video sample is always `near-median`. If the median is zero, zero-view
videos are `near-median` and positive-view videos are `above-median`; no
exceptional ratio is invented.

## Signals and minimum samples

| Signal | Minimum | Deterministic rule |
| --- | ---: | --- |
| `publication-inconsistency` | 4 videos | Publication-interval coefficient of variation `>= 0.50`. |
| `view-concentration` | 4 videos | Top-video share `>= 0.50` or top-three share `>= 0.80`. High impact additionally requires 8 videos. |
| `above-median-performance` | 3 videos | At least one video classified `exceptional`. |
| `relative-high-ctr` / `relative-low-ctr` | 4 videos with CTR | Value is respectively `>= 1.25` or `< 0.75` times the sample CTR median. |
| `relative-high-retention` / `relative-low-retention` | 4 videos with average percentage viewed | Value is respectively `>= 1.25` or `< 0.75` times its sample median. |
| `relative-high-engagement` / `relative-low-engagement` | 4 engagement-eligible videos | Rate is respectively `>= 1.25` or `< 0.75` times its sample median. |
| `publication-frequency-change` | 6 videos | Compare median earlier and recent intervals; absolute difference from the earlier median must be `>= 0.50`. |
| `duration-performance-association` | 6 videos, at least 2 per duration group | Relative difference between group median views must be `>= 0.35`. |
| `recurring-title-terms` | 3 videos | A normalized term occurs in at least 2 distinct titles and at least 50% of the sample. |

CTR and retention comparisons only use videos containing that exact metric.
`averageViewDurationSeconds` is never inferred from
`averagePercentageViewed`, or vice versa.

## Confidence

Confidence is a deterministic category, not a statistical probability. It is
based on signal sample size, metric availability within the effective sample,
and consistency (the share or normalized strength of qualifying evidence).

- `high`: sample `>= 8`, availability `>= 0.80`, consistency `>= 0.75`.
- `medium`: sample `>= 4`, availability `>= 0.50`, consistency `>= 0.50`.
- `low`: any other evaluated signal.

## Dates, exclusions, and validation

Dates must be real ISO dates. Date-only values and timestamp values with `Z`
or an explicit offset are accepted and compared as UTC instants. The requested
period boundaries are inclusive and calculations never depend on the machine's
local timezone.

Valid videos outside the requested period are excluded and recorded in data
quality. Videos later than `analysisDate` are errors even when outside the
requested period.

Validation fails the engine execution for:

- empty required IDs, names, or titles;
- duplicate video IDs;
- impossible or malformed dates, or an inverted period;
- future videos;
- non-finite or negative numeric metrics;
- CTR or average percentage viewed outside `0..100`.

Zero values remain valid. They can make a derived rate unavailable when its
denominator is zero. Missing optional metrics create partial analysis and data
quality limitations rather than validation errors.

## Title terms and V1 limitations

Title analysis lowercases text, removes diacritics and basic punctuation,
deduplicates terms within each title, and counts presence across titles. The
documented stop-word list is deliberately small and combines common English,
Spanish, French, and Portuguese words. It supports CreatorOS locales at a basic
lexical level but is not language detection, stemming, semantic analysis, or
topic detection; results are named `recurring-title-terms` accordingly.

V1 analyzes only the submitted inclusive-period sample. It has no YouTube API,
AI provider, database, authentication, external benchmark, causal model,
historical subscriber series, or recommendation generator.
