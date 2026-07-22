import type { Locale } from "../../../i18n/config";
import { formatAnalyzerValue } from "../formatters";
import type { AnalyzerMetricViewModel } from "../model";
import type { YouTubeAnalyzerDictionary } from "../types";
import styles from "../youtube-analyzer.module.css";

type MetricCardProps = {
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  metric: AnalyzerMetricViewModel;
};

export function MetricCard({ content, locale, metric }: MetricCardProps) {
  const copy = content.overview.metrics[metric.id];
  const unavailable = metric.value === null;

  return (
    <article className={styles.metricCard}>
      <p>{copy.label}</p>
      <strong className={unavailable ? styles.unavailableValue : undefined}>
        {formatAnalyzerValue(
          metric.value,
          metric.format,
          locale,
          content.overview.notAvailable,
        )}
      </strong>
      <span>{copy.detail}</span>
    </article>
  );
}
