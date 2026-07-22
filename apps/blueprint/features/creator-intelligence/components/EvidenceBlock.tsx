import type { EvidenceBlock as EvidenceBlockModel } from "../../../core";
import type { Locale } from "../../../i18n/config";
import {
  formatIntelligenceValue,
  resolveIntelligenceMessage,
} from "../formatters";
import type { CreatorIntelligenceDictionary } from "../types";
import styles from "../creator-intelligence.module.css";

export function EvidenceBlock({
  content,
  evidence,
  locale,
}: {
  content: CreatorIntelligenceDictionary;
  evidence: EvidenceBlockModel;
  locale: Locale;
}) {
  return (
    <div className={styles.evidenceItem} data-evidence-id={evidence.id}>
      <dt>{resolveIntelligenceMessage(content, evidence.labelKey)}</dt>
      <dd>{formatIntelligenceValue(evidence.value, evidence.unit, locale)}</dd>
    </div>
  );
}
