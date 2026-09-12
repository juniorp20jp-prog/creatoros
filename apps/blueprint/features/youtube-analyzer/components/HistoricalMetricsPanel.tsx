import { Card } from "@repo/ui";
import type { Locale } from "../../../i18n/config";
import type { Dictionary } from "../../../i18n/dictionaries";
import type { ChannelHistoryReadModel, ChannelTrendsReadModel } from "../../../server/youtube/http-contracts";
import styles from "../youtube-analyzer.module.css";

type Props = Readonly<{ content: Dictionary["blueprint"]["youtubeAnalyzer"]["realAnalyzer"]["history"]; locale: Locale; history: ChannelHistoryReadModel; trends: ChannelTrendsReadModel }>;
export function HistoricalMetricsPanel({ content, locale, history, trends }: Props) {
  const latest = history.observations.at(-1)?.observation;
  const subscriberTrend = trends.trends.find((trend) => trend.metric === "subscribers");
  const viewTrend = trends.trends.find((trend) => trend.metric === "views");
  return <Card className={styles.historyPanel} padding="lg">
    <div className={styles.historyHeading}><div><p className={styles.eyebrow}>{content.eyebrow}</p><h3>{content.title}</h3></div><span className={styles.freshnessBadge} data-state={trends.freshness.state}>{content.freshness[trends.freshness.state]}</span></div>
    <dl className={styles.historySummary}>
      <div><dt>{content.lastObservation}</dt><dd>{latest ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(latest.observedAt)) : content.unavailable}</dd></div>
      <div><dt>{content.coverage}</dt><dd>{content.observationCount.replace("{count}", String(history.observations.length))}</dd></div>
      <div><dt>{content.subscribers}</dt><dd>{formatTrend(subscriberTrend, locale, content)}</dd></div>
      <div><dt>{content.views}</dt><dd>{formatTrend(viewTrend, locale, content)}</dd></div>
    </dl>
    {history.observations.length < 2 ? <p className={styles.historyNotice}>{content.insufficient}</p> : null}
    {trends.freshness.partialCoverage ? <p className={styles.historyNotice}>{content.partial}</p> : null}
    <p className={styles.historyDisclaimer}>{content.nonCausal}</p>
  </Card>;
}
function formatTrend(trend: ChannelTrendsReadModel["trends"][number] | undefined, locale: Locale, content: Props["content"]): string { if (!trend || trend.state === "unavailable") return content.unavailable; const value = BigInt(trend.absoluteDelta); const prefix = value > 0n ? "+" : ""; return `${prefix}${new Intl.NumberFormat(locale).format(value)}`; }
