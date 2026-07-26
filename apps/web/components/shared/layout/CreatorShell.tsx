"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { Locale } from "../../../i18n/config";
import type { getDictionary } from "../../../i18n/dictionaries";

import { hqNavigation } from "../navigation/hq";
import { platformNavigation } from "../navigation/platform";
import { Sidebar } from "../navigation/Sidebar";

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
  const pathname = usePathname();

  const hqBasePath = `/${locale}/hq`;

  const isHq =
    pathname === hqBasePath ||
    pathname.startsWith(`${hqBasePath}/`);

  const navigation = isHq
    ? hqNavigation
    : platformNavigation;

  return (
    <main className={styles.appShell}>
      <aside className={styles.sidebar}>
        <Sidebar
          items={navigation}
          locale={locale}
          sectionLabel={
            isHq
              ? "INTELIGENCIA ESTRATÉGICA"
              : dictionary.navigation.platform
          }
          subtitle={
            isHq
              ? "Strategic Intelligence"
              : "Growth Intelligence"
          }
          title={isHq ? "CreatorOS HQ" : "CreatorOS"}
        />

        <div className={styles.sidebarFooter}>
          <p className={styles.planLabel}>
            {isHq
              ? "Estado del proyecto"
              : dictionary.dashboard.currentPlan}
          </p>

          <strong className={styles.planName}>
            {isHq ? "Sprint 9" : "CreatorOS MVP"}
          </strong>

          <span className={styles.planDetail}>
            {isHq
              ? "HQ en implementación"
              : dictionary.dashboard.developmentEnvironment}
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