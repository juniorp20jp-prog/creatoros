import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { cn } from "../../../utils";
import styles from "./Card.module.css";

export type CardVariant =
  | "default"
  | "elevated"
  | "interactive"
  | "highlighted";

export type CardPadding =
  | "none"
  | "sm"
  | "md"
  | "lg";

export interface CardProps
  extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    {
      children,
      title,
      subtitle,
      variant = "default",
      padding = "md",
      className,
      ...cardProps
    },
    ref,
  ) {
    const hasHeader = title != null || subtitle != null;

    return (
      <div
        {...cardProps}
        ref={ref}
        className={cn(
          styles.card,
          styles[variant],
          styles[`padding-${padding}`],
          className,
        )}
      >
        {hasHeader ? (
          <header className={styles.header}>
            {title != null ? (
              <h3 className={styles.title}>{title}</h3>
            ) : null}
            {subtitle != null ? (
              <p className={styles.subtitle}>{subtitle}</p>
            ) : null}
          </header>
        ) : null}

        <div className={styles.content}>{children}</div>
      </div>
    );
  },
);

Card.displayName = "Card";
