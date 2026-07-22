import type { IntelligenceQuality } from "../../../core";
import type { CreatorIntelligenceDictionary } from "../types";
import styles from "../creator-intelligence.module.css";

function LabelList({
  empty,
  labels,
  values,
}: {
  empty: string;
  labels: Readonly<Record<string, string>>;
  values: ReadonlyArray<string>;
}) {
  if (values.length === 0) {
    return <p className={styles.emptyValue}>{empty}</p>;
  }
  return (
    <ul className={styles.qualityList}>
      {values.map((value) => (
        <li key={value}>{labels[value] ?? value}</li>
      ))}
    </ul>
  );
}

export function IntelligenceQualityPanel({
  content,
  quality,
}: {
  content: CreatorIntelligenceDictionary;
  quality: IntelligenceQuality;
}) {
  const fieldLabels = content.quality.fieldLabels as Readonly<
    Record<string, string>
  >;
  const warningLabels = content.quality.warningLabels as Readonly<
    Record<string, string>
  >;
  const reasonLabels = content.quality.reasonLabels as Readonly<
    Record<string, string>
  >;

  return (
    <section aria-labelledby="intelligence-quality-title" className={styles.qualityPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.quality.eyebrow}</p>
          <h2 id="intelligence-quality-title">{content.quality.title}</h2>
        </div>
        <p>{content.quality.description}</p>
      </div>

      <dl className={styles.qualitySummary}>
        <div>
          <dt>{content.quality.overallStatus}</dt>
          <dd>{content.quality.statuses[quality.status]}</dd>
        </div>
        <div>
          <dt>{content.quality.sampleSize}</dt>
          <dd>{quality.sampleSize}</dd>
        </div>
        <div>
          <dt>{content.quality.insufficientMetrics}</dt>
          <dd>{quality.insufficientMetricCount}</dd>
        </div>
        <div>
          <dt>{content.quality.unevaluatedSignals}</dt>
          <dd>{quality.unevaluatedSignals.length}</dd>
        </div>
      </dl>

      <div className={styles.qualityColumns}>
        <article>
          <h3>{content.quality.completeFields}</h3>
          <LabelList
            empty={content.common.none}
            labels={fieldLabels}
            values={quality.fields.completelyAvailable}
          />
        </article>
        <article>
          <h3>{content.quality.partialFields}</h3>
          <LabelList
            empty={content.common.none}
            labels={fieldLabels}
            values={quality.fields.partiallyAvailable}
          />
        </article>
        <article>
          <h3>{content.quality.absentFields}</h3>
          <LabelList
            empty={content.common.none}
            labels={fieldLabels}
            values={quality.fields.absent}
          />
        </article>
      </div>

      <div className={styles.qualityDetails}>
        <article>
          <h3>{content.quality.warnings}</h3>
          <LabelList
            empty={content.common.none}
            labels={warningLabels}
            values={quality.warnings.map((warning) => warning.code)}
          />
        </article>
        <article>
          <h3>{content.quality.exclusions}</h3>
          {quality.exclusions.length === 0 ? (
            <p className={styles.emptyValue}>{content.common.none}</p>
          ) : (
            <ul className={styles.qualityList}>
              {quality.exclusions.map((exclusion) => (
                <li key={exclusion.videoId}>
                  {exclusion.videoId}: {content.quality.exclusionReason}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <div className={styles.unevaluatedBlock}>
        <h3>{content.quality.unevaluatedSignals}</h3>
        {quality.unevaluatedSignals.length === 0 ? (
          <p className={styles.emptyValue}>{content.common.none}</p>
        ) : (
          <ul>
            {quality.unevaluatedSignals.map((signal) => (
              <li key={`${signal.code}-${signal.reason}`}>
                <div>
                  <strong>{signal.code}</strong>
                  <span>{reasonLabels[signal.reason] ?? signal.reason}</span>
                </div>
                <span>
                  {content.quality.sampleComparison
                    .replace("{available}", String(signal.availableVideos))
                    .replace("{required}", String(signal.requiredVideos))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
