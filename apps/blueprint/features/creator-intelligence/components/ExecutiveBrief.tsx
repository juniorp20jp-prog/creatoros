import type { ExecutiveBrief as ExecutiveBriefModel } from "../../../core";
import { resolveIntelligenceMessage } from "../formatters";
import type { CreatorIntelligenceDictionary } from "../types";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import styles from "../creator-intelligence.module.css";

export function ExecutiveBrief({
  brief,
  content,
}: {
  brief: ExecutiveBriefModel;
  content: CreatorIntelligenceDictionary;
}) {
  const confidenceDescriptionId = "executive-brief-confidence-description";

  return (
    <section
      aria-labelledby="executive-brief-title"
      className={`${styles.executiveBrief} ${styles[`brief-${brief.status}`]}`}
    >
      <div className={styles.briefHeading}>
        <div>
          <p className={styles.eyebrow}>{content.brief.eyebrow}</p>
          <h2 id="executive-brief-title">{content.brief.title}</h2>
        </div>
        <div className={styles.briefStatus}>
          <span>{content.brief.statusLabel}</span>
          <strong>{content.brief.statuses[brief.status]}</strong>
        </div>
      </div>

      <p className={styles.briefHeadline}>
        {resolveIntelligenceMessage(
          content,
          brief.headline.messageKey,
          brief.headline.parameters,
        )}
      </p>

      <ul className={styles.briefStatements}>
        {brief.summary.map((statement) => (
          <li key={statement.id}>
            {resolveIntelligenceMessage(
              content,
              statement.messageKey,
              statement.parameters,
            )}
          </li>
        ))}
      </ul>

      <div className={styles.briefFooter}>
        <div>
          <span className={styles.metaLabel}>{content.confidence.label}</span>
          <ConfidenceIndicator
            confidence={brief.confidence}
            content={content}
            descriptionId={confidenceDescriptionId}
          />
        </div>
        <a className={styles.evidenceLink} href="#intelligence-evidence">
          {content.brief.viewEvidence}
          <span aria-hidden="true">↓</span>
        </a>
      </div>
      <p className={styles.confidenceExplanation} id={confidenceDescriptionId}>
        {content.confidence.explanation}
      </p>
    </section>
  );
}
