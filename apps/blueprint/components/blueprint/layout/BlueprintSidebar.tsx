"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "../../../i18n/config";
import type { BlueprintDictionary } from "../../../features/blueprint-dashboard/types";
import styles from "./blueprint-sidebar.module.css";

type BlueprintSidebarProps = {
  content: BlueprintDictionary["navigation"];
  locale: Locale;
};

type NavigationItem = {
  id: string;
  href: string;
  label: string;
};

export function BlueprintSidebar({
  content,
  locale,
}: BlueprintSidebarProps) {
  const pathname = usePathname();
  const navigation: NavigationItem[] = [
    { id: "overview", href: `/${locale}`, label: content.overview },
    {
      id: "missionControl",
      href: `/${locale}/mission-control`,
      label: content.missionControl,
    },
    {
      id: "creatorIntelligence",
      href: `/${locale}/creator-intelligence`,
      label: content.creatorIntelligence,
    },
    {
      id: "youtubeAnalyzer",
      href: `/${locale}/youtube-analyzer`,
      label: content.youtubeAnalyzer,
    },
    { id: "vision", href: `/${locale}#vision`, label: content.vision },
    {
      id: "architecture",
      href: `/${locale}#architecture`,
      label: content.architecture,
    },
    { id: "roadmap", href: `/${locale}#roadmap`, label: content.roadmap },
    { id: "engines", href: `/${locale}#engines`, label: content.engines },
    {
      id: "decisions",
      href: `/${locale}/decisions`,
      label: content.decisions,
    },
    { id: "research", href: `/${locale}#research`, label: content.research },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div
          aria-hidden="true"
          className={styles.brandMark}
        >
          C
        </div>

        <div className={styles.brandText}>
          <p className={styles.brandName}>CreatorOS</p>

          <p className={styles.brandSubtitle}>
            Blueprint
          </p>
        </div>
      </div>

      <nav
        aria-label={content.ariaLabel}
        className={styles.navigation}
      >
        <p className={styles.navigationLabel}>
          {content.label}
        </p>

        <ul className={styles.navigationList}>
          {navigation.map((item) => {
            const active =
              item.id === "overview"
                ? pathname === `/${locale}`
                : pathname === item.href;

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${styles.navigationItem} ${
                    active ? styles.navigationItemActive : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={styles.navigationIndicator}
                  />

                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <span
          className={styles.statusIndicator}
          aria-hidden="true"
        />

        <div>
          <p className={styles.statusLabel}>
            {content.footerTitle}
          </p>

          <p className={styles.statusDetail}>
            {content.footerDetail}
          </p>
        </div>
      </div>
    </aside>
  );
}
