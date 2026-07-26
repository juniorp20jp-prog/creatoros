"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "../../../app/[locale]/page.module.css";

import type { NavigationItem } from "./platform";

type SidebarProps = {
  title: string;
  subtitle: string;
  sectionLabel: string;
  items: NavigationItem[];
  locale: string;
};

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

export function Sidebar({
  title,
  subtitle,
  sectionLabel,
  items,
  locale,
}: SidebarProps) {
  const pathname = usePathname();

  function isItemActive(href: string): boolean {
    const localizedHref = normalizePath(`/${locale}${href}`);
    const currentPath = normalizePath(pathname);

    if (href === "/" || href === "/hq") {
      return currentPath === localizedHref;
    }

    return (
      currentPath === localizedHref ||
      currentPath.startsWith(`${localizedHref}/`)
    );
  }

  return (
    <>
      <div className={styles.brand}>
        <div className={styles.brandMark}>C</div>

        <div>
          <p className={styles.brandName}>{title}</p>
          <p className={styles.brandSubtitle}>{subtitle}</p>
        </div>
      </div>

      <nav aria-label={sectionLabel} className={styles.navigation}>
        <p className={styles.navigationLabel}>{sectionLabel}</p>

        {items.map((item) => {
          const active = isItemActive(item.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`${styles.navItem} ${
                active ? styles.navItemActive : ""
              }`}
              href={`/${locale}${item.href}`}
              key={item.id}
            >
              <span aria-hidden="true" className={styles.navIcon}>
                {item.icon}
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}