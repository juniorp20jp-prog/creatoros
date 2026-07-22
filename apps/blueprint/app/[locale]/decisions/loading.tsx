import styles from "../../../features/creator-decisions/creator-decisions.module.css";

export default function DecisionCenterLoading() {
  return (
    <div aria-busy="true" className={styles.loadingState}>
      <div className={styles.loadingHero} />
      <div className={styles.loadingSummary}>
        {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
      </div>
      <div className={styles.loadingCards}>
        {Array.from({ length: 3 }, (_, index) => <span key={index} />)}
      </div>
    </div>
  );
}
