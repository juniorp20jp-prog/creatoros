import type {
    LabelHTMLAttributes,
    ReactNode,
} from "react";

export interface LabelProps
    extends LabelHTMLAttributes<HTMLLabelElement> {
    children: ReactNode;

    required?: boolean;
}