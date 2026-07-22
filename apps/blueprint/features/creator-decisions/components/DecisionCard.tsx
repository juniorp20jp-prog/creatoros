import type {
  CreatorDecisionDictionary,
  CreatorDecisionViewModel,
} from "../types";
import styles from "../creator-decisions.module.css";
import { DecisionAlternatives } from "./DecisionAlternatives";
import { DecisionEvidenceList } from "./DecisionEvidenceList";
import { DecisionMetricsList } from "./DecisionMetricsList";

export function DecisionCard({
  content,
  decision,
  position,
}: {
  content: CreatorDecisionDictionary;
  decision: CreatorDecisionViewModel;
  position: number;
}) {
  const headingId = `decision-${position}-title`;
  return (
    <article
      aria-labelledby={headingId}
      className={`${styles.decisionCard} ${styles[`priority-${decision.priority}`]}`}
      data-decision-id={decision.id}
    >
      <div className={styles.cardHeader}>
        <span aria-hidden="true" className={styles.rank}>{position}</span>
        <div className={styles.cardTitle}>
          <div className={styles.badges}>
            <span className={styles.categoryBadge}>{decision.categoryLabel}</span>
            <span className={styles.priorityBadge}>
              {content.filters.priority}: {decision.priorityLabel}
            </span>
            <span className={styles.confidenceBadge}>
              {content.confidence.label}: {decision.confidenceLabel} · {decision.confidenceScore}
            </span>
          </div>
          <h3 id={headingId}>{decision.title}</h3>
          <p className={styles.cardSummary}>{decision.summary}</p>
        </div>
      </div>

      <div className={styles.reasonGrid}>
        <section>
          <h4>{content.sections.detected}</h4>
          <p>{decision.observation}</p>
        </section>
        <section>
          <h4>{content.sections.why}</h4>
          <p>{decision.interpretation}</p>
        </section>
      </div>

      <section className={styles.actionPanel}>
        <p className={styles.eyebrow}>{content.sections.action}</p>
        <p>{decision.recommendedAction}</p>
      </section>

      <div className={styles.impactMetricsGrid}>
        <section className={styles.impactPanel}>
          <h4>{content.sections.impact}</h4>
          <p>{decision.expectedImpact}</p>
        </section>
        <section>
          <h4>{content.sections.metrics}</h4>
          <DecisionMetricsList content={content} metrics={decision.metrics} />
        </section>
      </div>

      <details className={styles.decisionDetails}>
        <summary>{content.sections.details}</summary>
        <div className={styles.detailGrid}>
          <section>
            <h4>{content.sections.evidence}</h4>
            <DecisionEvidenceList content={content} evidence={decision.evidence} />
          </section>
          <section>
            <h4>{content.sections.confidence}</h4>
            <p className={styles.confidenceReading}>
              <strong>{decision.confidenceLabel} · {decision.confidenceScore}</strong>
              <span>{decision.confidenceExplanation}</span>
            </p>
          </section>
          <section>
            <h4>{content.sections.alternatives}</h4>
            <DecisionAlternatives alternatives={decision.alternatives} content={content} />
          </section>
        </div>
      </details>

      <footer className={styles.cardFooter}>
        <span>{content.list.ruleLabel}: {decision.ruleId}</span>
        <span>{content.list.createdLabel}: {decision.createdAt}</span>
      </footer>
    </article>
  );
}

