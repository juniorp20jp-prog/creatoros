import type { YouTubeSignalConfidence } from "../../../core";
import type { CreatorIntelligenceDictionary } from "../types";
import styles from "../creator-intelligence.module.css";

export function ConfidenceIndicator({
  confidence,
  content,
  descriptionId,
}: {
  confidence: YouTubeSignalConfidence | null;
  content: CreatorIntelligenceDictionary;
  descriptionId: string;
}) {
  const confidenceKey = confidence ?? "notEvaluated";

  return (
    <span
      aria-describedby={descriptionId}
      className={`${styles.confidenceIndicator} ${styles[confidenceKey]}`}
    >
      <span aria-hidden="true" className={styles.confidenceMark} />
      {content.confidence.values[confidenceKey]}
    </span>
  );
}
