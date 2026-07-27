import { cn } from "../../../utils";

import styles from "./Field.module.css";
import type { FieldProps } from "./Field.types";

export function Field({
    id,
    label,
    optionalText,
    helperText,
    errorText,
    required = false,
    children,
    className,
    ...fieldProps
}: FieldProps) {
    const helperTextId = helperText
        ? `${id}-helper`
        : undefined;

    const errorTextId = errorText
        ? `${id}-error`
        : undefined;

    const showHeader =
        Boolean(label) ||
        (!required && Boolean(optionalText));

    return (
        <div
            {...fieldProps}
            className={cn(
                styles.root,
                className,
            )}
            data-invalid={Boolean(errorText)}
        >
            {showHeader ? (
                <div className={styles.labelRow}>
                    {label ? (
                        <label
                            className={styles.label}
                            htmlFor={id}
                        >
                            {label}

                            {required ? (
                                <span
                                    aria-hidden="true"
                                    className={
                                        styles.requiredIndicator
                                    }
                                >
                                    *
                                </span>
                            ) : null}
                        </label>
                    ) : (
                        <span />
                    )}

                    {!required && optionalText ? (
                        <span
                            className={styles.optionalText}
                        >
                            {optionalText}
                        </span>
                    ) : null}
                </div>
            ) : null}

            <div className={styles.control}>
                {children}
            </div>

            {errorText ? (
                <p
                    className={styles.errorText}
                    id={errorTextId}
                    role="alert"
                >
                    {errorText}
                </p>
            ) : helperText ? (
                <p
                    className={styles.helperText}
                    id={helperTextId}
                >
                    {helperText}
                </p>
            ) : null}
        </div>
    );
}