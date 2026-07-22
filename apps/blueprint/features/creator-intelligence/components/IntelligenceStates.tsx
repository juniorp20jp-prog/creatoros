import type { CreatorIntelligenceDictionary } from "../types";
import styles from "../creator-intelligence.module.css";

export function IntelligenceEmptyState({
  content,
}: {
  content: CreatorIntelligenceDictionary;
}) {
  return (
    <section className={styles.statePanel}>
      <p className={styles.eyebrow}>{content.states.empty}</p>
      <h2>{content.states.emptyTitle}</h2>
      <p>{content.states.emptyDescription}</p>
    </section>
  );
}

export function IntelligenceNoInsightsState({
  content,
}: {
  content: CreatorIntelligenceDictionary;
}) {
  return (
    <section className={styles.noInsightsPanel}>
      <p className={styles.eyebrow}>{content.states.noInsightsLabel}</p>
      <h2>{content.states.noInsightsTitle}</h2>
      <p>{content.states.noInsightsDescription}</p>
    </section>
  );
}

export function IntelligenceErrorState({
  content,
  errorCode,
  type,
}: {
  content: CreatorIntelligenceDictionary;
  errorCode: string;
  type: "validation-error" | "unexpected-error";
}) {
  const validation = type === "validation-error";
  return (
    <section
      className={`${styles.statePanel} ${styles.errorPanel}`}
      data-error-code={errorCode}
      role="alert"
    >
      <p className={styles.eyebrow}>{content.states[type]}</p>
      <h2>
        {validation
          ? content.states.validationTitle
          : content.states.unexpectedTitle}
      </h2>
      <p>
        {validation
          ? content.states.validationDescription
          : content.states.unexpectedDescription}
      </p>
      <span>{content.states.recoverHint}</span>
    </section>
  );
}
