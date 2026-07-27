"use client";

import {
    forwardRef,
    useId,
} from "react";
import { cva } from "class-variance-authority";

import { cn } from "../../../utils";
import { Field } from "../Field";

import styles from "./Input.module.css";
import type { InputProps } from "./Input.types";

const inputContainerVariants = cva(
    styles.inputContainer,
    {
        variants: {
            inputSize: {
                sm: styles.sizeSm,
                md: styles.sizeMd,
                lg: styles.sizeLg,
            },
            status: {
                default: styles.statusDefault,
                error: styles.statusError,
                success: styles.statusSuccess,
            },
            disabled: {
                true: styles.disabled,
                false: undefined,
            },
            readOnly: {
                true: styles.readOnly,
                false: undefined,
            },
        },
        defaultVariants: {
            inputSize: "md",
            status: "default",
            disabled: false,
            readOnly: false,
        },
    },
);

export const Input = forwardRef<
    HTMLInputElement,
    InputProps
>(function Input(
    {
        id,
        label,
        helperText,
        errorText,
        optionalText,
        inputSize = "md",
        status = "default",
        leftIcon,
        rightIcon,
        prefix,
        suffix,
        fullWidth = false,
        containerClassName,
        inputClassName,
        className,
        required,
        disabled,
        readOnly,
        "aria-describedby": ariaDescribedBy,
        "aria-invalid": ariaInvalid,
        ...inputProps
    },
    ref,
) {
    const generatedId = useId();
    const inputId = id ?? `input-${generatedId}`;

    const helperTextId = helperText
        ? `${inputId}-helper`
        : undefined;

    const errorTextId = errorText
        ? `${inputId}-error`
        : undefined;

    const resolvedStatus = errorText
        ? "error"
        : status;

    const descriptionId = errorText
        ? errorTextId
        : helperTextId;

    const describedBy = [
        ariaDescribedBy,
        descriptionId,
    ]
        .filter(Boolean)
        .join(" ") || undefined;

    const isInvalid =
        ariaInvalid ??
        (resolvedStatus === "error"
            ? true
            : undefined);

    return (
        <Field
            id={inputId}
            label={label}
            optionalText={optionalText}
            helperText={helperText}
            errorText={errorText}
            required={required}
            className={cn(
                styles.root,
                fullWidth && styles.fullWidth,
                containerClassName,
            )}
            data-disabled={disabled || undefined}
            data-readonly={readOnly || undefined}
            data-status={resolvedStatus}
        >
            <div
                className={inputContainerVariants({
                    inputSize,
                    status: resolvedStatus,
                    disabled: Boolean(disabled),
                    readOnly: Boolean(readOnly),
                })}
            >
                {leftIcon ? (
                    <span
                        aria-hidden="true"
                        className={styles.icon}
                        data-position="left"
                    >
                        {leftIcon}
                    </span>
                ) : null}

                {prefix ? (
                    <span className={styles.affix}>
                        {prefix}
                    </span>
                ) : null}

                <input
                    {...inputProps}
                    ref={ref}
                    id={inputId}
                    required={required}
                    disabled={disabled}
                    readOnly={readOnly}
                    aria-describedby={describedBy}
                    aria-invalid={isInvalid}
                    className={cn(
                        styles.input,
                        inputClassName,
                        className,
                    )}
                />

                {suffix ? (
                    <span className={styles.affix}>
                        {suffix}
                    </span>
                ) : null}

                {rightIcon ? (
                    <span
                        aria-hidden="true"
                        className={styles.icon}
                        data-position="right"
                    >
                        {rightIcon}
                    </span>
                ) : null}
            </div>
        </Field>
    );
});

Input.displayName = "Input";
