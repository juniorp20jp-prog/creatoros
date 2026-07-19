import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline";

export type ButtonSize = "small" | "medium" | "large";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

function joinClassNames(
  ...classNames: Array<string | false | null | undefined>
): string {
  return classNames.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "medium",
  fullWidth = false,
  iconOnly = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  type = "button",
  "aria-label": ariaLabel,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  if (iconOnly && !ariaLabel) {
    throw new Error(
      "Button: iconOnly requires an accessible aria-label.",
    );
  }

  return (
    <button
      type={type}
      className={joinClassNames(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        iconOnly && styles.iconOnly,
        className,
      )}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading || undefined}
      aria-label={ariaLabel}
      {...props}
    >
      {isLoading && (
        <span
          className={styles.spinner}
          aria-hidden="true"
        />
      )}

      <span
        className={joinClassNames(
          styles.content,
          isLoading && styles.loadingContent,
        )}
      >
        {leftIcon && (
          <span
            className={styles.icon}
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}

        {!iconOnly && children}

        {rightIcon && (
          <span
            className={styles.icon}
            aria-hidden="true"
          >
            {rightIcon}
          </span>
        )}
      </span>
    </button>
  );
}