import type { YouTubeAnalyzerDictionary } from "../types";
import styles from "../youtube-analyzer.module.css";

export function AnalyzerEmptyState({
  content,
}: {
  content: YouTubeAnalyzerDictionary;
}) {
  return (
    <section className={styles.statePanel}>
      <p className={styles.eyebrow}>{content.states.empty}</p>
      <h2>{content.states.emptyTitle}</h2>
      <p>{content.states.emptyDescription}</p>
    </section>
  );
}

export function AnalyzerErrorState({
  content,
  errorCode,
  type,
}: {
  content: YouTubeAnalyzerDictionary;
  errorCode: string;
  type: "validation-error" | "unexpected-error";
}) {
  const validation = type === "validation-error";

  return (
    <section className={`${styles.statePanel} ${styles.errorPanel}`} data-error-code={errorCode} role="alert">
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
