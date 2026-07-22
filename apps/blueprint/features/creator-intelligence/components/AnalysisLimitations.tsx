import type { IntelligenceLimitation } from "../../../core";
import { resolveIntelligenceMessage } from "../formatters";
import type { CreatorIntelligenceDictionary } from "../types";
import styles from "../creator-intelligence.module.css";

export function AnalysisLimitations({
  content,
  limitations,
}: {
  content: CreatorIntelligenceDictionary;
  limitations: ReadonlyArray<IntelligenceLimitation>;
}) {
  return (
    <aside aria-labelledby="intelligence-limitations-title" className={styles.limitationsPanel}>
      <div>
        <p className={styles.eyebrow}>{content.limitations.eyebrow}</p>
        <h2 id="intelligence-limitations-title">{content.limitations.title}</h2>
      </div>
      <p>{content.limitations.description}</p>
      {limitations.length === 0 ? (
        <p className={styles.emptyValue}>{content.common.none}</p>
      ) : (
        <ul>
          {limitations.map((limitation) => (
            <li key={limitation.id}>
              {resolveIntelligenceMessage(
                content,
                limitation.messageKey,
                limitation.parameters,
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
