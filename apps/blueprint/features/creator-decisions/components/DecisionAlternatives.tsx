import type {
  CreatorDecisionDictionary,
  DecisionAlternativeViewModel,
} from "../types";
import styles from "../creator-decisions.module.css";

export function DecisionAlternatives({
  alternatives,
  content,
}: {
  alternatives: ReadonlyArray<DecisionAlternativeViewModel>;
  content: CreatorDecisionDictionary;
}) {
  return (
    <ul className={styles.alternativeList}>
      {alternatives.map((alternative) => (
        <li key={alternative.id}>
          <p><strong>{content.alternatives.action}:</strong> {alternative.action}</p>
          <p><strong>{content.alternatives.discardedBecause}:</strong> {alternative.discardedBecause}</p>
          <p><strong>{content.alternatives.reconsiderWhen}:</strong> {alternative.reconsiderWhen}</p>
        </li>
      ))}
    </ul>
  );
}

