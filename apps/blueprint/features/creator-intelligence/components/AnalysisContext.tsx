import type { IntelligenceAnalysisContext } from "../../../core";
import type { Locale } from "../../../i18n/config";
import { formatIntelligenceDate } from "../formatters";
import type { CreatorIntelligenceDictionary } from "../types";
import styles from "../creator-intelligence.module.css";

export function AnalysisContext({
  content,
  context,
  locale,
  scenarioLabel,
}: {
  content: CreatorIntelligenceDictionary;
  context: IntelligenceAnalysisContext;
  locale: Locale;
  scenarioLabel: string;
}) {
  const metricLabels = content.quality.fieldLabels as Readonly<
    Record<string, string>
  >;

  return (
    <section aria-labelledby="analysis-context-title" className={styles.surfacePanel}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.context.eyebrow}</p>
          <h2 id="analysis-context-title">{content.context.title}</h2>
        </div>
        <p>{content.context.description}</p>
      </div>
      <dl className={styles.contextGrid}>
        <div>
          <dt>{content.context.channel}</dt>
          <dd>{context.channel.name}</dd>
        </div>
        <div>
          <dt>{content.context.scenario}</dt>
          <dd>{scenarioLabel}</dd>
        </div>
        <div>
          <dt>{content.context.startDate}</dt>
          <dd>{formatIntelligenceDate(context.requestedPeriod.startDate, locale)}</dd>
        </div>
        <div>
          <dt>{content.context.endDate}</dt>
          <dd>{formatIntelligenceDate(context.requestedPeriod.endDate, locale)}</dd>
        </div>
        <div>
          <dt>{content.context.receivedVideos}</dt>
          <dd>{context.inputVideoCount}</dd>
        </div>
        <div>
          <dt>{content.context.includedVideos}</dt>
          <dd>{context.includedVideoCount}</dd>
        </div>
        <div>
          <dt>{content.context.excludedVideos}</dt>
          <dd>{context.excludedVideoCount}</dd>
        </div>
        <div>
          <dt>{content.context.effectiveSample}</dt>
          <dd>{context.effectiveSampleSize}</dd>
        </div>
        <div>
          <dt>{content.context.generatedAt}</dt>
          <dd>{formatIntelligenceDate(context.generatedAt, locale)}</dd>
        </div>
      </dl>
      <div className={styles.metricAvailability}>
        <h3>{content.context.availableMetrics}</h3>
        <ul>
          {context.availableMetrics.map((metric) => (
            <li key={metric}>{metricLabels[metric] ?? metric}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
