import { Button } from "@repo/ui";

import type { DashboardHeroContent } from "../types";

import styles from "../../../app/[locale]/page.module.css";

type DashboardHeroProps = DashboardHeroContent;

export function DashboardHero({
  heroLabel,
  headline,
  description,
  createMissionLabel,
  explorePlatformLabel,
  activeMissionLabel,
  notConfiguredLabel,
  progressLabel,
  probabilityLabel,
  estimatedDateLabel,
}: DashboardHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <p className={styles.heroLabel}>{heroLabel}</p>

        <h2 className={styles.heroTitle}>{headline}</h2>

        <p className={styles.heroDescription}>
          {description}
        </p>

        <div className={styles.heroActions}>
          <Button>{createMissionLabel}</Button>

          <Button variant="secondary">
            {explorePlatformLabel}
          </Button>
        </div>
      </div>

      <div className={styles.missionCard}>
        <p className={styles.missionCardLabel}>
          {activeMissionLabel}
        </p>

        <h3 className={styles.missionCardTitle}>
          {notConfiguredLabel}
        </h3>

        <div className={styles.progressTrack}>
          <div className={styles.progressValue} />
        </div>

        <div className={styles.missionStats}>
          <div>
            <span>{progressLabel}</span>
            <strong>0%</strong>
          </div>

          <div>
            <span>{probabilityLabel}</span>
            <strong>—</strong>
          </div>

          <div>
            <span>{estimatedDateLabel}</span>
            <strong>—</strong>
          </div>
        </div>
      </div>
    </section>
  );
}