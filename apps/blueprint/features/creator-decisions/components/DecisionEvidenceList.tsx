import type {
  CreatorDecisionDictionary,
  DecisionEvidenceViewModel,
} from "../types";
import styles from "../creator-decisions.module.css";

export function DecisionEvidenceList({
  content,
  evidence,
}: {
  content: CreatorDecisionDictionary;
  evidence: ReadonlyArray<DecisionEvidenceViewModel>;
}) {
  return (
    <dl className={styles.evidenceList}>
      {evidence.map((item) => (
        <div key={item.id}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          <span><strong>{content.sections.source}:</strong> {item.sourceRef}</span>
        </div>
      ))}
    </dl>
  );
}

