"use client";

import { useMemo } from "react";

import { Button, Card } from "@repo/ui";

import type { Locale } from "../../../i18n/config";
import type { Dictionary } from "../../../i18n/dictionaries";
import { YouTubeVideoApiClient } from "../client";
import { useRealYouTubeAnalyzer } from "../hooks";
import { createRealYouTubeAnalyzerViewModel } from "../model";
import { AnalysisOverview } from "./AnalysisOverview";
import { DataQualityPanel } from "./DataQualityPanel";
import { HistoricalMetricsPanel } from "./HistoricalMetricsPanel";
import { YouTubeAnalyticsPanel } from "./YouTubeAnalyticsPanel";
import { PublishingInsights } from "./PublishingInsights";
import { SignalsPanel } from "./SignalsPanel";
import { VideoPerformanceTable } from "./VideoPerformanceTable";
import styles from "../youtube-analyzer.module.css";

type Props = Readonly<{
  content: Dictionary["blueprint"]["youtubeAnalyzer"];
  locale: Locale;
  client?: YouTubeVideoApiClient;
}>;

export function RealYouTubeAnalyzerExperience({
  content,
  locale,
  client,
}: Props) {
  const defaultClient = useMemo(() => new YouTubeVideoApiClient(), []);
  const controller = useRealYouTubeAnalyzer(client ?? defaultClient);
  const real = content.realAnalyzer;
  const viewModel = controller.intelligence
    ? createRealYouTubeAnalyzerViewModel(controller.intelligence.output)
    : null;
  const sync = controller.synchronization;

  return (
    <section aria-labelledby="youtube-real-analysis-title" className={styles.realWorkspace}>
      <Card className={styles.realHeader} padding="lg" variant="highlighted">
        <div>
          <p className={styles.eyebrow}>{real.eyebrow}</p>
          <h2 id="youtube-real-analysis-title">{real.title}</h2>
          <p>{real.description}</p>
        </div>
        <Button
          disabled={controller.operation === "synchronizing"}
          isLoading={controller.operation === "synchronizing"}
          loadingContent={real.synchronizing}
          onClick={() => void controller.synchronizeAndAnalyze()}
        >
          {real.action}
        </Button>
      </Card>

      {controller.phase === "loading" ? (
        <Card aria-busy="true" aria-live="polite" className={styles.realState} padding="lg">
          <span className={styles.realSpinner} aria-hidden="true" />
          <span>{real.loading}</span>
        </Card>
      ) : null}

      {controller.phase === "empty" ? (
        <Card className={styles.realState} padding="lg">
          <h3>{real.emptyTitle}</h3>
          <p>{real.emptyDescription}</p>
        </Card>
      ) : null}

      {controller.phase === "unauthenticated" ? (
        <Card className={styles.realState} padding="lg">
          <h3>{content.connection.authenticationTitle}</h3>
          <p role="alert">{content.connection.errors.unauthenticated}</p>
        </Card>
      ) : null}

      {controller.phase === "error" ? (
        <Card className={styles.realState} padding="lg">
          <h3>{real.errorTitle}</h3>
          <p role="alert">{real.errors[controller.error ?? "generic"] ?? real.errors.generic}</p>
          <Button onClick={() => void controller.reload()} variant="secondary">
            {real.retry}
          </Button>
        </Card>
      ) : null}

      {controller.phase === "success" && viewModel ? (
        <div aria-live="polite" className={styles.realAnalysis}>
          <Card className={styles.coverage} padding="md">
            <strong>{real.realDataNotice}</strong>
            <span>
              {formatCoverage(
                sync?.coverageCount ?? viewModel.quality.effectiveVideoCount,
                sync?.coverageLimit ?? 50,
                sync?.truncated ?? false,
                real,
              )}
            </span>
            {controller.intelligence && controller.intelligence.excludedVideoCount > 0 ? (
              <span>
                {real.excluded.replace(
                  "{count}",
                  String(controller.intelligence.excludedVideoCount),
                )}
              </span>
            ) : null}
          </Card>

          {controller.outcome ? (
            <p className={styles.realOutcome} role="status">
              {controller.outcome === "no-change"
                ? real.noChange
                : controller.outcome === "partial"
                  ? real.partial
                  : real.completed}
            </p>
          ) : null}
          {controller.error ? (
            <p className={styles.realError} role="alert">
              {real.errors[controller.error] ?? real.errors.generic}
            </p>
          ) : null}

          {controller.history && controller.trends ? (
            <HistoricalMetricsPanel content={real.history} history={controller.history} locale={locale} trends={controller.trends} />
          ) : null}

          <YouTubeAnalyticsPanel
            analytics={controller.analytics}
            content={real.analytics}
            error={controller.analyticsError !== null}
            locale={locale}
            onPeriodChange={(period) => void controller.setAnalyticsPeriod(period)}
            onSynchronize={() => void controller.synchronizeAnalytics()}
            period={controller.analyticsPeriod}
            status={controller.analyticsStatus}
            synchronizing={controller.analyticsOperation === "synchronizing"}
          />

          <AnalysisOverview content={content} locale={locale} metrics={viewModel.metrics} />
          <PublishingInsights content={content} locale={locale} publishing={viewModel.publishing} />
          <VideoPerformanceTable content={content} locale={locale} videos={viewModel.videos} />
          <SignalsPanel content={content} locale={locale} signals={viewModel.signals} />
          <DataQualityPanel content={content} quality={viewModel.quality} />
        </div>
      ) : null}
    </section>
  );
}

function formatCoverage(
  count: number,
  limit: number,
  truncated: boolean,
  content: Dictionary["blueprint"]["youtubeAnalyzer"]["realAnalyzer"],
): string {
  const template = truncated ? content.coverageTruncated : content.coverageExact;
  return template
    .replace("{count}", String(count))
    .replace("{limit}", String(limit));
}
