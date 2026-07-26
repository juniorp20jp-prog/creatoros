import { Card } from "@repo/ui";

import type { DashboardMetric } from "../types";

import styles from "../../../app/[locale]/page.module.css";

type MetricsGridProps = {
  metrics: DashboardMetric[];
};

export function MetricsGrid({
  metrics,
}: MetricsGridProps) {
  return (
    <section className={styles.metricsGrid}>
      {metrics.map((metric) => (
        <Card key={metric.id} padding="md">
          <p className={styles.metricLabel}>
            {metric.label}
          </p>

          <h3 className={styles.metricValue}>
            {metric.value}
          </h3>

          <p className={styles.metricDetail}>
            {metric.detail}
          </p>
        </Card>
      ))}
    </section>
  );
}