import type {
  DashboardAction,
  DashboardHeroContent,
  DashboardMetric,
  DashboardSectionContent,
} from "../types";

import { DashboardHero } from "./DashboardHero";
import { MetricsGrid } from "./MetricsGrid";

import styles from "../../../app/[locale]/page.module.css";

type DashboardPageProps = {
  hero: DashboardHeroContent;
  metrics: DashboardMetric[];
  actions: DashboardAction[];
  section: DashboardSectionContent;
};

export function DashboardPage({
  hero,
  metrics,
  actions,
  section,
}: DashboardPageProps) {
  return (
    <div className={styles.content}>
      <DashboardHero {...hero} />

      <MetricsGrid metrics={metrics} />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>
              {section.guidedSetupLabel}
            </p>

            <h2 className={styles.sectionTitle}>
              {section.nextActionsLabel}
            </h2>
          </div>

          <span className={styles.sectionStatus}>
            {section.completedCountLabel}
          </span>
        </div>

        <div className={styles.actionsGrid}>
          {actions.map((action, index) => (
            <article
              className={`${styles.actionCard} ${
                action.featured || index === 0
                  ? styles.actionCardFeatured
                  : ""
              }`}
              key={action.id}
            >
              <span className={styles.actionStep}>
                {action.step}
              </span>

              <h3 className={styles.actionTitle}>
                {action.title}
              </h3>

              <p className={styles.actionDescription}>
                {action.description}
              </p>

              <button
                className={styles.actionLink}
                type="button"
              >
                {section.startLabel} →
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}