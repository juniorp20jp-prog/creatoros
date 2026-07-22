import type { Locale } from "../../../i18n/config";
import type { AnalyzerMetricViewModel } from "../model";
import type { YouTubeAnalyzerDictionary } from "../types";
import { MetricCard } from "./MetricCard";
import styles from "../youtube-analyzer.module.css";

type AnalysisOverviewProps = {
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  metrics: ReadonlyArray<AnalyzerMetricViewModel>;
};

export function AnalysisOverview({
  content,
  locale,
  metrics,
}: AnalysisOverviewProps) {
  return (
    <section aria-labelledby="analysis-overview-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.overview.eyebrow}</p>
          <h2 id="analysis-overview-title">{content.overview.title}</h2>
        </div>
        <p>{content.overview.description}</p>
      </div>
      <div className={styles.metricsGrid}>
        {metrics.map((metric) => (
          <MetricCard
            content={content}
            key={metric.id}
            locale={locale}
            metric={metric}
          />
        ))}
      </div>
    </section>
  );
}
