import type {
  CreatorDecisionDictionary,
  DecisionMetricViewModel,
} from "../types";
import styles from "../creator-decisions.module.css";

export function DecisionMetricsList({
  content,
  metrics,
}: {
  content: CreatorDecisionDictionary;
  metrics: ReadonlyArray<DecisionMetricViewModel>;
}) {
  return (
    <dl className={styles.metricList}>
      {metrics.map((metric) => (
        <div key={metric.id}>
          <dt>{metric.label}</dt>
          <dd>
            <span>{content.sections.baseline}: <strong>{metric.baseline}</strong></span>
            <span>{content.sections.target}: <strong>{metric.target}</strong></span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

