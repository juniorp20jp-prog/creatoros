import { cn } from "../../../utils";

import styles from "./Label.module.css";
import type { LabelProps } from "./Label.types";

export function Label({
    children,
    required = false,
    className,
    ...labelProps
}: LabelProps) {
    return (
        <label
            {...labelProps}
            className={cn(
                styles.label,
                className,
            )}
        >
            {children}

            {required ? (
                <span
                    aria-hidden="true"
                    className={styles.requiredIndicator}
                >
                    *
                </span>
            ) : null}
        </label>
    );
}