import type { EvidenceBlock } from "../../../core";
import type { Locale } from "../../../i18n/config";
import type { CreatorIntelligenceDictionary } from "../types";
import { EvidenceList } from "./EvidenceList";
import styles from "../creator-intelligence.module.css";

export function EvidenceSection({
  content,
  evidence,
  locale,
}: {
  content: CreatorIntelligenceDictionary;
  evidence: ReadonlyArray<EvidenceBlock>;
  locale: Locale;
}) {
  return (
    <section
      aria-labelledby="intelligence-evidence-title"
      className={styles.surfacePanel}
      id="intelligence-evidence"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.evidence.eyebrow}</p>
          <h2 id="intelligence-evidence-title">{content.evidence.title}</h2>
        </div>
        <p>{content.evidence.description}</p>
      </div>
      <EvidenceList content={content} evidence={evidence} locale={locale} />
    </section>
  );
}
