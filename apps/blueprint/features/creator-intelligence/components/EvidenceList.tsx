import type { EvidenceBlock } from "../../../core";
import type { Locale } from "../../../i18n/config";
import type { CreatorIntelligenceDictionary } from "../types";
import { EvidenceBlock as EvidenceItem } from "./EvidenceBlock";
import styles from "../creator-intelligence.module.css";

export function EvidenceList({
  content,
  evidence,
  locale,
}: {
  content: CreatorIntelligenceDictionary;
  evidence: ReadonlyArray<EvidenceBlock>;
  locale: Locale;
}) {
  return (
    <dl className={styles.evidenceList}>
      {evidence.map((item) => (
        <EvidenceItem
          content={content}
          evidence={item}
          key={item.id}
          locale={locale}
        />
      ))}
    </dl>
  );
}
