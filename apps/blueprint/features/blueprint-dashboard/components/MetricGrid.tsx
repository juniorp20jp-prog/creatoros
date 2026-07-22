import type {
  BlueprintDictionary,
  DashboardData,
} from "../types";
import styles from "../blueprint-dashboard.module.css";

type MetricGridProps = {
  content: BlueprintDictionary["dashboard"];
  metrics: DashboardData["metrics"];
};

export function MetricGrid({
  content,
  metrics,
}: MetricGridProps) {
  return (
    <section
      aria-label={content.metricsAriaLabel}
      className={styles.metricGrid}
    >
      {metrics.map((metric) => {
        const copy = content.metrics[metric.id];

        return (
          <article className={styles.metricCard} key={metric.id}>
            <span
              aria-hidden="true"
              className={`${styles.metricMarker} ${styles[metric.tone]}`}
            />
            <p className={styles.metricLabel}>{copy.label}</p>
            <strong className={styles.metricValue}>{copy.value}</strong>
            <p className={styles.metricDetail}>{copy.detail}</p>
          </article>
        );
      })}
    </section>
  );
}
