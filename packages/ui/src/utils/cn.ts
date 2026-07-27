export type ClassValue =
    | string
    | false
    | null
    | undefined;

/**
 * Combina nombres de clases y elimina valores falsos.
 *
 * @example
 * cn(
 *     styles.root,
 *     disabled && styles.disabled,
 *     className,
 * );
 */
export function cn(
    ...classNames: ClassValue[]
): string {
    return classNames
        .filter(
            (
                className,
            ): className is string =>
                typeof className === "string" &&
                className.length > 0,
        )
        .join(" ");
}