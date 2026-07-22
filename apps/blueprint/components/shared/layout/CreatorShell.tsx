import type { ReactNode } from "react";

import type { Locale } from "../../../i18n/config";
import type { getDictionary } from "../../../i18n/dictionaries";

import styles from "../../../app/[locale]/page.module.css";

type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

type CreatorShellProps = {
  children: ReactNode;
  dictionary: Dictionary;
  locale: Locale;
};

export function CreatorShell({
  children,
  dictionary,
  locale,
}: CreatorShellProps) {
  const navigation = [
    {
      id: "mission-control",
      label: dictionary.navigation.missionControl,
    },
    {
      id: "my-channel",
      label: dictionary.navigation.myChannel,
    },
    {
      id: "competitors",
      label: dictionary.navigation.competitors,
    },
    {
      id: "ai-strategy",
      label: dictionary.navigation.aiStrategy,
    },
    {
      id: "viral-ideas",
      label: dictionary.navigation.viralIdeas,
    },
    {
      id: "analytics",
      label: dictionary.navigation.analytics,
    },
    {
      id: "settings",
      label: dictionary.navigation.settings,
    },
  ];

  return (
    <main className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>C</div>

          <div>
            <p className={styles.brandName}>CreatorOS</p>

            <p className={styles.brandSubtitle}>
              Growth Intelligence
            </p>
          </div>
        </div>

        <nav
          aria-label={dictionary.navigation.platform}
          className={styles.navigation}
        >
          <p className={styles.navigationLabel}>
            {dictionary.navigation.platform}
          </p>

          {navigation.map((item, index) => (
            <button
              aria-current={index === 0 ? "page" : undefined}
              className={`${styles.navItem} ${
                index === 0 ? styles.navItemActive : ""
              }`}
              key={item.id}
              type="button"
            >
              <span
                aria-hidden="true"
                className={styles.navDot}
              />

              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.planLabel}>
            {dictionary.dashboard.currentPlan}
          </p>

          <strong className={styles.planName}>
            CreatorOS MVP
          </strong>

          <span className={styles.planDetail}>
            {dictionary.dashboard.developmentEnvironment}
          </span>

          <span className={styles.planDetail}>
            {locale.toUpperCase()}
          </span>
        </div>
      </aside>

      <section className={styles.workspace}>
        {children}
      </section>
    </main>
  );
}