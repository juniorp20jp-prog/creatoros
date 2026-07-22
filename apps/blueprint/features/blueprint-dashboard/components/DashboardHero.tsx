import type { BlueprintDictionary } from "../types";
import styles from "../blueprint-dashboard.module.css";

type DashboardHeroProps = {
  content: BlueprintDictionary["dashboard"];
  version: string;
};

export function DashboardHero({
  content,
  version,
}: DashboardHeroProps) {
  return (
    <section className={styles.hero} id="vision">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{content.hero.eyebrow}</p>
        <h2 className={styles.heroTitle}>{content.hero.title}</h2>
        <p className={styles.heroDescription}>
          {content.hero.description}
        </p>
      </div>

      <dl className={styles.heroStatus}>
        <div>
          <dt>{content.hero.projectLabel}</dt>
          <dd>
            <span className={styles.liveIndicator} aria-hidden="true" />
            {content.hero.projectValue}
          </dd>
        </div>
        <div>
          <dt>{content.hero.versionLabel}</dt>
          <dd>{version}</dd>
        </div>
        <div>
          <dt>{content.hero.buildLabel}</dt>
          <dd className={styles.buildPassing}>
            {content.hero.buildValue}
          </dd>
        </div>
      </dl>
    </section>
  );
}
