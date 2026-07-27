import type {
    HTMLAttributes,
    ReactNode,
} from "react";

export interface FieldProps
    extends Omit<
        HTMLAttributes<HTMLDivElement>,
        "children"
    > {
    id: string;

    label?: ReactNode;

    optionalText?: ReactNode;

    helperText?: ReactNode;

    errorText?: ReactNode;

    required?: boolean;

    children: ReactNode;
}