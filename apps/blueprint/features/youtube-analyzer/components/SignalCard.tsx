import type { Locale } from "../../../i18n/config";
import { formatAnalyzerValue } from "../formatters";
import type { AnalyzerSignalViewModel } from "../model";
import type { YouTubeAnalyzerDictionary } from "../types";
import styles from "../youtube-analyzer.module.css";

type SignalCardProps = {
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  signal: AnalyzerSignalViewModel;
};

export function SignalCard({ content, locale, signal }: SignalCardProps) {
  const signalCopy = (
    content.signals.items as Readonly<
      Record<string, { name: string; description: string }>
    >
  )[signal.code];
  const evidenceLabels = content.evidence as Readonly<Record<string, string>>;

  return (
    <article className={styles.signalCard}>
      <div className={styles.signalHeader}>
        <div>
          <p className={styles.signalCode}>{signal.code}</p>
          <h3>{signalCopy?.name ?? signal.code}</h3>
        </div>
        <span className={`${styles.impactBadge} ${styles[signal.impact]}`}>
          {content.signals.impact[signal.impact]}
        </span>
      </div>
      <p className={styles.signalDescription}>
        {signalCopy?.description ?? signal.code}
      </p>

      <dl className={styles.signalMeta}>
        <div>
          <dt>{content.signals.confidenceLabel}</dt>
          <dd>{content.signals.confidence[signal.confidence]}</dd>
        </div>
        <div>
          <dt>{content.signals.sampleLabel}</dt>
          <dd>{signal.effectiveSampleSize}</dd>
        </div>
      </dl>

      <div className={styles.evidenceBlock}>
        <h4>{content.signals.evidenceLabel}</h4>
        <dl>
          {signal.evidence.map((item) => (
            <div key={item.key}>
              <dt>{evidenceLabels[item.key] ?? item.key}</dt>
              <dd>
                {formatAnalyzerValue(
                  item.value,
                  item.format,
                  locale,
                  content.overview.notAvailable,
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {signal.relatedTerms.length > 0 ? (
        <div className={styles.relatedData}>
          <strong>{content.signals.termsLabel}</strong>
          <span>{signal.relatedTerms.join(", ")}</span>
        </div>
      ) : null}
      <div className={styles.relatedData}>
        <strong>{content.signals.videoIdsLabel}</strong>
        <span>{signal.relatedVideoIds.join(", ")}</span>
      </div>
    </article>
  );
}
