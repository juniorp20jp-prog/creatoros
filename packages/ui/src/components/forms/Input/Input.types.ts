import type {
    InputHTMLAttributes,
    ReactNode,
} from "react";

export type InputSize = "sm" | "md" | "lg";

export type InputStatus =
    | "default"
    | "error"
    | "success";

export interface InputProps
    extends Omit<
        InputHTMLAttributes<HTMLInputElement>,
        "prefix" | "size"
    > {
    /**
     * Texto visible asociado al campo.
     */
    label?: string;

    /**
     * Texto complementario mostrado debajo del campo.
     */
    helperText?: string;

    /**
     * Mensaje de error.
     *
     * Cuando existe, tiene prioridad sobre `helperText`.
     */
    errorText?: string;

    /**
     * Texto utilizado para indicar que el campo es opcional.
     */
    optionalText?: string;

    /**
     * Tamaño visual del campo.
     *
     * @default "md"
     */
    inputSize?: InputSize;

    /**
     * Estado visual y semántico del campo.
     *
     * El estado cambia automáticamente a `error`
     * cuando se proporciona `errorText`.
     *
     * @default "default"
     */
    status?: InputStatus;

    /**
     * Elemento mostrado dentro del campo, en el lado izquierdo.
     */
    leftIcon?: ReactNode;

    /**
     * Elemento mostrado dentro del campo, en el lado derecho.
     */
    rightIcon?: ReactNode;

    /**
     * Contenido textual o visual mostrado antes del valor.
     *
     * Ejemplos:
     * - $
     * - https://
     * - @
     */
    prefix?: ReactNode;

    /**
     * Contenido textual o visual mostrado después del valor.
     *
     * Ejemplos:
     * - USD
     * - %
     * - .com
     */
    suffix?: ReactNode;

    /**
     * Hace que el componente ocupe todo el ancho disponible.
     *
     * @default false
     */
    fullWidth?: boolean;

    /**
     * Clase personalizada aplicada al contenedor principal.
     */
    containerClassName?: string;

    /**
     * Clase personalizada aplicada al elemento input.
     */
    inputClassName?: string;
}
