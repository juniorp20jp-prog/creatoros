import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../../../utils";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline";

export type ButtonSize =
  | "sm"
  | "md"
  | "lg"
  | "small"
  | "medium"
  | "large";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  isLoading?: boolean;
  loadingContent?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const normalizedSizes: Record<ButtonSize, "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "md",
  lg: "lg",
  small: "sm",
  medium: "md",
  large: "lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = "primary",
      size = "md",
      fullWidth = false,
      iconOnly = false,
      isLoading = false,
      loadingContent,
      leftIcon,
      rightIcon,
      disabled,
      className,
      type = "button",
      "aria-label": ariaLabel,
      ...buttonProps
    },
    ref,
  ) {
    if (iconOnly && !ariaLabel) {
      throw new Error(
        "Button: iconOnly requires an accessible aria-label.",
      );
    }

    const isDisabled = Boolean(disabled || isLoading);
    const normalizedSize = normalizedSizes[size];

    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        className={cn(
          styles.button,
          styles[variant],
          styles[normalizedSize],
          fullWidth && styles.fullWidth,
          iconOnly && styles.iconOnly,
          isLoading && styles.loading,
          className,
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        aria-label={ariaLabel}
      >
        {isLoading ? (
          <span className={styles.loadingContent}>
            <span
              className={styles.spinner}
              aria-hidden="true"
            />
            {loadingContent ?? (
              <span className={styles.visuallyHidden}>
                {children}
              </span>
            )}
          </span>
        ) : (
          <span className={styles.content}>
            {leftIcon ? (
              <span
                className={styles.icon}
                aria-hidden="true"
              >
                {leftIcon}
              </span>
            ) : null}

            {iconOnly ? null : children}

            {rightIcon ? (
              <span
                className={styles.icon}
                aria-hidden="true"
              >
                {rightIcon}
              </span>
            ) : null}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
