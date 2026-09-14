"use client";

import { Button, Card } from "@repo/ui";
import type { Locale } from "../../../i18n/config";
import type { Dictionary } from "../../../i18n/dictionaries";
import type { YouTubeAnalyticsChannelReadModel, YouTubeAnalyticsStatusReadModel } from "../../../server/youtube/http-contracts";
import styles from "../youtube-analyzer.module.css";

type Props = Readonly<{
  content: Dictionary["blueprint"]["youtubeAnalyzer"]["realAnalyzer"]["analytics"];
  locale: Locale;
  status: YouTubeAnalyticsStatusReadModel | null;
  analytics: YouTubeAnalyticsChannelReadModel | null;
  period: "7d" | "30d" | "90d";
  synchronizing: boolean;
  error: boolean;
  onPeriodChange(period: "7d" | "30d" | "90d"): void;
  onSynchronize(): void;
}>;

export function YouTubeAnalyticsPanel({ content, locale, status, analytics, period, synchronizing, error, onPeriodChange, onSynchronize }: Props) {
  const authorized = status?.state === "authorized";
  return (
    <Card className={styles.analyticsPanel} padding="lg">
      <div className={styles.analyticsHeading}>
        <div><p className={styles.eyebrow}>{content.eyebrow}</p><h3>{content.title}</h3><p>{content.description}</p></div>
        {authorized ? <Button disabled={synchronizing} isLoading={synchronizing} loadingContent={content.synchronizing} onClick={onSynchronize}>{content.sync}</Button> : <Button onClick={() => { window.location.assign(`/api/youtube/analytics/connect?returnTo=/${locale}/youtube-analyzer`); }}>{content.connect}</Button>}
      </div>
      {!authorized ? <div className={styles.analyticsState} role="status"><strong>{status?.state === "declined" ? content.declined : status?.state === "temporarily-unavailable" ? content.unavailable : content.notAuthorized}</strong><span>{content.optional}</span></div> : null}
      {error ? <p className={styles.realError} role="alert">{content.error}</p> : null}
      {authorized ? <>
        <label className={styles.analyticsPeriod}>{content.period}<select value={period} onChange={(event) => onPeriodChange(event.target.value as "7d" | "30d" | "90d")}><option value="7d">7d</option><option value="30d">30d</option><option value="90d">90d</option></select></label>
        {analytics?.availability === "no-data" || !analytics ? <p className={styles.analyticsState}>{content.noData}</p> : <>
          <dl className={styles.analyticsMetrics}>
            {metric(content.watchTime, analytics.values.estimatedMinutesWatched, locale, content.unavailableValue)}
            {metric(content.averageViewDuration, analytics.values.averageViewDuration, locale, content.unavailableValue)}
            {metric(content.averagePercentageViewed, analytics.values.averageViewPercentage, locale, content.unavailableValue)}
            {metric(content.subscribersGained, analytics.values.subscribersGained, locale, content.unavailableValue)}
            {metric(content.subscribersLost, analytics.values.subscribersLost, locale, content.unavailableValue)}
            {metric(content.netSubscribers, analytics.values.netSubscribers, locale, content.unavailableValue)}
          </dl>
          <p className={styles.analyticsFootnote}>{content.effectiveThrough.replace("{date}", analytics.effectiveDataThrough ?? content.unavailableValue)} · {analytics.freshness === "processing" ? content.processing : content.current}</p>
        </>}
      </> : null}
    </Card>
  );
}

function metric(label: string, value: string | undefined, locale: Locale, unavailable: string) { const number = value === undefined ? undefined : Number(value); return <div><dt>{label}</dt><dd>{number !== undefined && Number.isFinite(number) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(number) : unavailable}</dd></div>; }
