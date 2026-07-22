import type { Locale } from "../../../i18n/config";
import { formatAnalyzerValue } from "../formatters";
import type { YouTubeAnalyzerSuccessViewModel } from "../model";
import type { YouTubeAnalyzerDictionary } from "../types";
import styles from "../youtube-analyzer.module.css";

type PublishingInsightsProps = {
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  publishing: YouTubeAnalyzerSuccessViewModel["publishing"];
};

function evaluationLabel(
  detected: boolean,
  unevaluated: boolean,
  content: YouTubeAnalyzerDictionary,
): string {
  if (detected) {
    return content.publishing.detected;
  }
  return unevaluated
    ? content.publishing.notEvaluated
    : content.publishing.notDetected;
}

export function PublishingInsights({
  content,
  locale,
  publishing,
}: PublishingInsightsProps) {
  return (
    <section
      aria-labelledby="publishing-insights-title"
      className={styles.surfacePanel}
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.publishing.eyebrow}</p>
          <h2 id="publishing-insights-title">{content.publishing.title}</h2>
        </div>
        <p>{content.publishing.description}</p>
      </div>

      <dl className={styles.publishingMetrics}>
        <div>
          <dt>{content.publishing.includedVideos}</dt>
          <dd>{publishing.includedVideoCount}</dd>
        </div>
        <div>
          <dt>{content.publishing.averageInterval}</dt>
          <dd>
            {formatAnalyzerValue(
              publishing.averageIntervalDays,
              "days",
              locale,
              content.overview.notAvailable,
            )}
          </dd>
        </div>
        <div>
          <dt>{content.publishing.medianInterval}</dt>
          <dd>
            {formatAnalyzerValue(
              publishing.medianIntervalDays,
              "days",
              locale,
              content.overview.notAvailable,
            )}
          </dd>
        </div>
        <div>
          <dt>{content.publishing.variability}</dt>
          <dd>
            {formatAnalyzerValue(
              publishing.coefficientOfVariation,
              "percentage-ratio",
              locale,
              content.overview.notAvailable,
            )}
          </dd>
        </div>
      </dl>

      <div className={styles.publishingSignals}>
        <div>
          <span>{content.publishing.consistencySignal}</span>
          <strong>
            {evaluationLabel(
              publishing.inconsistencySignal !== null,
              publishing.inconsistencyUnevaluated,
              content,
            )}
          </strong>
        </div>
        <div>
          <span>{content.publishing.frequencyChangeSignal}</span>
          <strong>
            {evaluationLabel(
              publishing.frequencyChangeSignal !== null,
              publishing.frequencyChangeUnevaluated,
              content,
            )}
          </strong>
        </div>
      </div>
    </section>
  );
}
