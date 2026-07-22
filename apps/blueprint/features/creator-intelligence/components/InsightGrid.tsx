import type { CreatorInsight } from "../../../core";
import type { Locale } from "../../../i18n/config";
import type { CreatorIntelligenceDictionary } from "../types";
import { InsightCard } from "./InsightCard";
import styles from "../creator-intelligence.module.css";

export function InsightGrid({
  content,
  eyebrow,
  insights,
  locale,
  title,
  titleId,
}: {
  content: CreatorIntelligenceDictionary;
  eyebrow: string;
  insights: ReadonlyArray<CreatorInsight>;
  locale: Locale;
  title: string;
  titleId: string;
}) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={titleId} className={styles.insightSection}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <p>{content.insights.description}</p>
      </div>
      <div className={styles.insightGrid}>
        {insights.map((insight) => (
          <InsightCard
            content={content}
            insight={insight}
            key={insight.id}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}
