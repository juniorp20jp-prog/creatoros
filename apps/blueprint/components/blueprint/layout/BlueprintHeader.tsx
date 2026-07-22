import type { Locale } from "../../../i18n/config";
import type { BlueprintDictionary } from "../../../features/blueprint-dashboard/types";
import styles from "./blueprint-header.module.css";

type BlueprintHeaderProps = {
  content: BlueprintDictionary["header"];
  locale: Locale;
  version: string;
};

export function BlueprintHeader({
  content,
  locale,
  version,
}: BlueprintHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.description}>
          {content.description}
        </p>
      </div>

      <dl className={styles.actions}>
        <div className={styles.projectState}>
          <dt>{content.projectLabel}</dt>
          <dd>
            <span aria-hidden="true" className={styles.statusDot} />
            {content.projectValue}
          </dd>
        </div>
        <div className={styles.headerMeta}>
          <dt>{content.versionLabel}</dt>
          <dd>{version}</dd>
        </div>
        <div className={styles.headerMeta}>
          <dt>{content.buildLabel}</dt>
          <dd className={styles.buildStatus}>{content.buildValue}</dd>
        </div>
        <div
          aria-label={`${content.languageLabel}: ${locale}`}
          className={styles.localeBadge}
        >
          <dt>{content.languageLabel}</dt>
          <dd>{locale}</dd>
        </div>
      </dl>
    </header>
  );
}
