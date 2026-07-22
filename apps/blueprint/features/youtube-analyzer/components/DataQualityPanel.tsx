import type { YouTubeDataQuality, YouTubeSignalCode } from "../../../core";
import type { YouTubeAnalyzerDictionary } from "../types";
import styles from "../youtube-analyzer.module.css";

type DataQualityPanelProps = {
  content: YouTubeAnalyzerDictionary;
  quality: YouTubeDataQuality;
};

function translatedValue(
  values: Readonly<Record<string, string>>,
  value: string,
): string {
  return values[value] ?? value;
}

function QualityList({
  emptyLabel,
  items,
  labels,
}: {
  emptyLabel: string;
  items: ReadonlyArray<string>;
  labels: Readonly<Record<string, string>>;
}) {
  if (items.length === 0) {
    return <p className={styles.qualityEmpty}>{emptyLabel}</p>;
  }

  return (
    <ul className={styles.qualityList}>
      {items.map((item) => (
        <li key={item}>{translatedValue(labels, item)}</li>
      ))}
    </ul>
  );
}

export function DataQualityPanel({
  content,
  quality,
}: DataQualityPanelProps) {
  const fieldLabels = content.quality.fieldLabels as Readonly<
    Record<string, string>
  >;
  const warningLabels = content.quality.warningLabels as Readonly<
    Record<string, string>
  >;
  const limitationLabels = content.quality.limitationLabels as Readonly<
    Record<string, string>
  >;
  const signalItems = content.signals.items as Readonly<
    Record<YouTubeSignalCode, { name: string; description: string }>
  >;

  return (
    <section
      aria-labelledby="data-quality-title"
      className={styles.qualityPanel}
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.quality.eyebrow}</p>
          <h2 id="data-quality-title">{content.quality.title}</h2>
        </div>
        <p>{content.quality.description}</p>
      </div>

      <dl className={styles.qualitySummary}>
        <div>
          <dt>{content.quality.inputVideos}</dt>
          <dd>{quality.inputVideoCount}</dd>
        </div>
        <div>
          <dt>{content.quality.effectiveVideos}</dt>
          <dd>{quality.effectiveVideoCount}</dd>
        </div>
        <div>
          <dt>{content.quality.excludedVideos}</dt>
          <dd>{quality.excludedVideos.length}</dd>
        </div>
        <div>
          <dt>{content.quality.unevaluated}</dt>
          <dd>{quality.unevaluatedSignals.length}</dd>
        </div>
      </dl>

      <div className={styles.qualityColumns}>
        <article>
          <h3>{content.quality.completeFields}</h3>
          <QualityList
            emptyLabel={content.quality.none}
            items={quality.fields.completelyAvailable}
            labels={fieldLabels}
          />
        </article>
        <article>
          <h3>{content.quality.partialFields}</h3>
          <QualityList
            emptyLabel={content.quality.none}
            items={quality.fields.partiallyAvailable}
            labels={fieldLabels}
          />
        </article>
        <article>
          <h3>{content.quality.absentFields}</h3>
          <QualityList
            emptyLabel={content.quality.none}
            items={quality.fields.absent}
            labels={fieldLabels}
          />
        </article>
      </div>

      <div className={styles.qualityDetails}>
        <article>
          <h3>{content.quality.warnings}</h3>
          <QualityList
            emptyLabel={content.quality.none}
            items={quality.warnings.map((warning) => warning.code)}
            labels={warningLabels}
          />
        </article>
        <article>
          <h3>{content.quality.limitations}</h3>
          <QualityList
            emptyLabel={content.quality.none}
            items={quality.limitations}
            labels={limitationLabels}
          />
        </article>
      </div>

      {quality.excludedVideos.length > 0 ? (
        <article className={styles.excludedBlock}>
          <h3>{content.quality.excludedVideos}</h3>
          <ul className={styles.qualityList}>
            {quality.excludedVideos.map((video) => (
              <li key={video.videoId}>
                <strong>{video.videoId}</strong>: {content.quality.excludedReason}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className={styles.unevaluatedBlock}>
        <h3>{content.quality.unevaluated}</h3>
        {quality.unevaluatedSignals.length === 0 ? (
          <p className={styles.qualityEmpty}>{content.quality.none}</p>
        ) : (
          <ul>
            {quality.unevaluatedSignals.map((signal) => (
              <li key={`${signal.code}-${signal.reason}`}>
                <div>
                  <strong>{signalItems[signal.code].name}</strong>
                  <span>{content.quality.reasons[signal.reason]}</span>
                </div>
                <dl>
                  <div>
                    <dt>{content.quality.requiredVideos}</dt>
                    <dd>{signal.requiredVideos}</dd>
                  </div>
                  <div>
                    <dt>{content.quality.availableVideos}</dt>
                    <dd>{signal.availableVideos}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
