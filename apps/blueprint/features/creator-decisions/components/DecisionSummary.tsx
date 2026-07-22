import type {
  CreatorDecisionDictionary,
  DecisionSummaryViewModel,
} from "../types";
import styles from "../creator-decisions.module.css";

export function DecisionSummary({
  content,
  summary,
}: {
  content: CreatorDecisionDictionary;
  summary: DecisionSummaryViewModel;
}) {
  return (
    <section aria-labelledby="decision-summary-title" className={styles.summaryPanel}>
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>{content.summary.eyebrow}</p>
        <h2 id="decision-summary-title">{content.summary.title}</h2>
      </div>
      <dl className={styles.summaryGrid}>
        <div><dt>{content.summary.total}</dt><dd>{summary.total}</dd></div>
        <div><dt>{content.summary.high}</dt><dd>{summary.high}</dd></div>
        <div><dt>{content.summary.medium}</dt><dd>{summary.medium}</dd></div>
        <div><dt>{content.summary.low}</dt><dd>{summary.low}</dd></div>
      </dl>
      <div className={styles.summaryNarrative}>
        <div>
          <h3>{content.summary.highestAction}</h3>
          <p>{summary.highestPriorityAction ?? content.common.none}</p>
        </div>
        <div>
          <h3>{content.summary.confidence}</h3>
          <p>{summary.confidenceSummary}</p>
        </div>
      </div>
    </section>
  );
}

