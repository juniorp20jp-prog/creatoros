import type { Locale } from "../../../i18n/config";
import type { AnalyzerSignalViewModel } from "../model";
import type { YouTubeAnalyzerDictionary } from "../types";
import { SignalCard } from "./SignalCard";
import styles from "../youtube-analyzer.module.css";

type SignalsPanelProps = {
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  signals: ReadonlyArray<AnalyzerSignalViewModel>;
};

export function SignalsPanel({
  content,
  locale,
  signals,
}: SignalsPanelProps) {
  return (
    <section aria-labelledby="signals-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.signals.eyebrow}</p>
          <h2 id="signals-title">{content.signals.title}</h2>
        </div>
        <p>{content.signals.description}</p>
      </div>

      {signals.length === 0 ? (
        <p className={styles.emptyPanel}>{content.signals.empty}</p>
      ) : (
        <div className={styles.signalsGrid}>
          {signals.map((signal) => (
            <SignalCard
              content={content}
              key={signal.code}
              locale={locale}
              signal={signal}
            />
          ))}
        </div>
      )}
    </section>
  );
}
