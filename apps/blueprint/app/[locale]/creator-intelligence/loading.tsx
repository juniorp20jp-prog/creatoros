import styles from "../../../features/creator-intelligence/creator-intelligence.module.css";

export default function CreatorIntelligenceLoading() {
  return (
    <div aria-busy="true" className={styles.loadingState}>
      <div className={styles.loadingHero} />
      <div className={styles.loadingGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
