import Link from "next/link";

import { blueprintModules, moduleCategories } from "../module-registry";
import type {
  BlueprintDictionary,
  BlueprintModuleDefinition,
} from "../types";
import type { Locale } from "../../../i18n/config";
import styles from "../blueprint-dashboard.module.css";

type ModuleGridProps = {
  content: BlueprintDictionary;
  locale: Locale;
};

function ModuleCard({
  content,
  locale,
  module,
}: ModuleGridProps & {
  module: BlueprintModuleDefinition;
}) {
  const copy = content.modules[module.id];
  const cardContent = (
    <>
      <div className={styles.moduleCardHeader}>
        <span aria-hidden="true" className={styles.moduleGlyph}>
          {module.glyph}
        </span>
        <span className={styles.moduleStatus}>
          {content.dashboard.modules.statuses[module.availability]}
        </span>
      </div>
      <h3>{copy.name}</h3>
      <p>{copy.description}</p>
      <span className={styles.moduleRoute} aria-hidden="true">
        /{module.route}
      </span>
    </>
  );

  if (module.availability === "available") {
    return (
      <Link
        className={styles.moduleCard}
        href={`/${locale}/${module.route}`}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <article
      className={styles.moduleCard}
      id={module.id === "researchCenter" ? "research" : undefined}
    >
      {cardContent}
    </article>
  );
}

export function ModuleGrid({
  content,
  locale,
}: ModuleGridProps) {
  return (
    <section
      aria-labelledby="modules-heading"
      className={styles.modulesSection}
      id="engines"
    >
      <div className={styles.modulesHeading}>
        <div>
          <p className={styles.eyebrow}>
            {content.dashboard.modules.eyebrow}
          </p>
          <h2 id="modules-heading">
            {content.dashboard.modules.title}
          </h2>
        </div>
        <p>{content.dashboard.modules.description}</p>
      </div>

      <div className={styles.moduleCategories}>
        {moduleCategories.map((category) => {
          const modules = blueprintModules.filter(
            (module) => module.category === category,
          );

          return (
            <section
              aria-labelledby={`category-${category}`}
              className={styles.moduleCategory}
              key={category}
            >
              <h3 id={`category-${category}`}>
                {content.dashboard.modules.categories[category]}
              </h3>
              <div className={styles.moduleGrid}>
                {modules.map((module) => (
                  <ModuleCard
                    content={content}
                    key={module.id}
                    locale={locale}
                    module={module}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
