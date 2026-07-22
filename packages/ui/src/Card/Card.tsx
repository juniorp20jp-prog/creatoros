import type { ComponentPropsWithoutRef, ReactNode } from "react";

import styles from "./Card.module.css";

export type CardProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
};

export function Card({
  children,
  title,
  subtitle,
  padding = "md",
  className,
  ...props
}: CardProps) {
  const classes = [styles.card, styles[`padding-${padding}`], className]
    .filter(Boolean)
    .join(" ");

  const hasTitle = title !== undefined && title !== null;
  const hasSubtitle = subtitle !== undefined && subtitle !== null;

  return (
    <div className={classes} {...props}>
      {(hasTitle || hasSubtitle) && (
        <header className={styles.header}>
          {hasTitle && <h3 className={styles.title}>{title}</h3>}
          {hasSubtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </header>
      )}

      <div className={styles.content}>{children}</div>
    </div>
  );
}
