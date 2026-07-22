import type {
  CreatorDecisionDictionary,
  CreatorDecisionViewModel,
} from "../types";
import styles from "../creator-decisions.module.css";
import { DecisionCard } from "./DecisionCard";

export function DecisionList({
  content,
  decisions,
  total,
}: {
  content: CreatorDecisionDictionary;
  decisions: ReadonlyArray<CreatorDecisionViewModel>;
  total: number;
}) {
  return (
    <section aria-labelledby="decision-list-title" className={styles.decisionListSection}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.list.eyebrow}</p>
          <h2 id="decision-list-title">{content.list.title}</h2>
          <p>{content.list.description}</p>
        </div>
        <strong>
          {content.list.showing
            .replace("{visible}", String(decisions.length))
            .replace("{total}", String(total))}
        </strong>
      </div>
      {decisions.length === 0 ? (
        <div className={styles.filteredState} role="status">
          <h3>{content.states.filteredTitle}</h3>
          <p>{content.states.filteredDescription}</p>
        </div>
      ) : (
        <ol className={styles.decisionList}>
          {decisions.map((decision, index) => (
            <li key={decision.id}>
              <DecisionCard content={content} decision={decision} position={index + 1} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

