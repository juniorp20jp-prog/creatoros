import styles from "../../../features/youtube-analyzer/youtube-analyzer.module.css";

export default function YouTubeAnalyzerLoading() {
  return (
    <div aria-busy="true" className={styles.loadingState}>
      <div className={styles.loadingHero} />
      <div className={styles.loadingGrid}>
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
