import type { CreatorIntelligenceDictionary } from "../types";
import styles from "../creator-intelligence.module.css";

export function NextStepPanel({
  content,
}: {
  content: CreatorIntelligenceDictionary;
}) {
  return (
    <aside aria-labelledby="intelligence-next-step-title" className={styles.nextStepPanel}>
      <p className={styles.eyebrow}>{content.nextStep.eyebrow}</p>
      <h2 id="intelligence-next-step-title">{content.nextStep.title}</h2>
      <p>{content.nextStep.description}</p>
      <span>{content.nextStep.availability}</span>
    </aside>
  );
}
