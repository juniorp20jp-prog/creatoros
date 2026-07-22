import type { CreatorInsight } from "../../../core";
import type { Locale } from "../../../i18n/config";
import { resolveIntelligenceMessage } from "../formatters";
import type { CreatorIntelligenceDictionary } from "../types";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { EvidenceList } from "./EvidenceList";
import styles from "../creator-intelligence.module.css";

export function InsightCard({
  content,
  insight,
  locale,
}: {
  content: CreatorIntelligenceDictionary;
  insight: CreatorInsight;
  locale: Locale;
}) {
  const confidenceDescriptionId = `confidence-${insight.id.replaceAll(".", "-")}`;
  const limitationLabels = content.insights.limitations as Readonly<
    Record<string, string>
  >;

  return (
    <article
      className={`${styles.insightCard} ${styles[`category-${insight.category}`]} ${styles[`priority-${insight.priority}`]}`}
      data-insight-id={insight.id}
    >
      <div className={styles.insightLabels}>
        <span className={styles.categoryLabel}>
          {content.insights.categories[insight.category]}
        </span>
        <span className={styles.priorityLabel}>
          {content.insights.priorityLabel}: {content.insights.priorities[insight.priority]}
        </span>
      </div>
      <h3>
        {resolveIntelligenceMessage(
          content,
          insight.titleKey,
          insight.parameters,
        )}
      </h3>
      <p className={styles.insightDescription}>
        {resolveIntelligenceMessage(
          content,
          insight.descriptionKey,
          insight.parameters,
        )}
      </p>

      <dl className={styles.insightMeta}>
        <div>
          <dt>{content.confidence.label}</dt>
          <dd>
            <ConfidenceIndicator
              confidence={insight.confidence}
              content={content}
              descriptionId={confidenceDescriptionId}
            />
          </dd>
        </div>
        <div>
          <dt>{content.insights.sampleLabel}</dt>
          <dd>
            {insight.sampleSize === null
              ? content.common.notAvailable
              : insight.sampleSize}
          </dd>
        </div>
      </dl>
      <p className={styles.visuallyHidden} id={confidenceDescriptionId}>
        {content.confidence.explanation}
      </p>

      {insight.limitations.length > 0 ? (
        <div className={styles.cardLimitations}>
          <h4>{content.insights.limitationLabel}</h4>
          <ul>
            {insight.limitations.map((limitation) => (
              <li key={limitation}>
                {limitationLabels[limitation] ?? limitation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className={styles.evidenceDetails}>
        <summary>{content.insights.expandEvidence}</summary>
        <EvidenceList
          content={content}
          evidence={insight.evidence}
          locale={locale}
        />
        {insight.sourceSignalIds.length > 0 ? (
          <p className={styles.sourceTrace}>
            <strong>{content.insights.sourceSignalsLabel}:</strong>{" "}
            {insight.sourceSignalIds.join(", ")}
          </p>
        ) : null}
        {insight.relatedVideoIds.length > 0 ? (
          <p className={styles.sourceTrace}>
            <strong>{content.insights.relatedVideosLabel}:</strong>{" "}
            {insight.relatedVideoIds.join(", ")}
          </p>
        ) : null}
      </details>
    </article>
  );
}
