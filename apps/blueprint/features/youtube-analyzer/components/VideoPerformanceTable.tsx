import type { Locale } from "../../../i18n/config";
import { formatAnalyzerDate, formatAnalyzerValue } from "../formatters";
import type { AnalyzerVideoViewModel } from "../model";
import type { YouTubeAnalyzerDictionary } from "../types";
import styles from "../youtube-analyzer.module.css";

type VideoPerformanceTableProps = {
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  videos: ReadonlyArray<AnalyzerVideoViewModel>;
};

export function VideoPerformanceTable({
  content,
  locale,
  videos,
}: VideoPerformanceTableProps) {
  return (
    <section aria-labelledby="video-performance-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.videos.eyebrow}</p>
          <h2 id="video-performance-title">{content.videos.title}</h2>
        </div>
        <p>{content.videos.description}</p>
      </div>

      <div className={styles.tableScroll} tabIndex={0}>
        <table>
          <caption className={styles.visuallyHidden}>
            {content.videos.tableLabel}
          </caption>
          <thead>
            <tr>
              <th scope="col">{content.videos.titleColumn}</th>
              <th scope="col">{content.videos.date}</th>
              <th scope="col">{content.videos.duration}</th>
              <th scope="col">{content.videos.views}</th>
              <th scope="col">{content.videos.classification}</th>
              <th scope="col">{content.videos.engagement}</th>
              <th scope="col">{content.videos.ctr}</th>
              <th scope="col">{content.videos.retention}</th>
              <th scope="col">{content.videos.subscribers}</th>
              <th scope="col">{content.videos.medianComparison}</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <tr key={video.id}>
                <th scope="row">
                  <span className={styles.videoTitle}>{video.title}</span>
                  <span className={styles.videoId}>{video.id}</span>
                </th>
                <td>{formatAnalyzerDate(video.publishedAt, locale)}</td>
                <td>
                  {formatAnalyzerValue(
                    video.durationSeconds,
                    "seconds",
                    locale,
                    content.overview.notAvailable,
                  )}
                </td>
                <td>
                  {formatAnalyzerValue(
                    video.views,
                    "integer",
                    locale,
                    content.overview.notAvailable,
                  )}
                </td>
                <td>
                  <span
                    className={`${styles.classificationBadge} ${styles[video.classification]}`}
                  >
                    {content.classifications[video.classification]}
                  </span>
                </td>
                <td>
                  {formatAnalyzerValue(
                    video.engagementRate,
                    "percentage-ratio",
                    locale,
                    content.overview.notAvailable,
                  )}
                </td>
                <td>
                  {formatAnalyzerValue(
                    video.ctr,
                    "percentage-points",
                    locale,
                    content.overview.notAvailable,
                  )}
                </td>
                <td>
                  {formatAnalyzerValue(
                    video.averagePercentageViewed,
                    "percentage-points",
                    locale,
                    content.overview.notAvailable,
                  )}
                </td>
                <td>
                  {formatAnalyzerValue(
                    video.subscribersGained,
                    "integer",
                    locale,
                    content.overview.notAvailable,
                  )}
                </td>
                <td>
                  {formatAnalyzerValue(
                    video.viewsToMedianRatio,
                    "decimal",
                    locale,
                    content.overview.notAvailable,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
