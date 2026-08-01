/* eslint-disable react/prop-types, @typescript-eslint/no-unused-vars */
import { createElement, forwardRef } from "react";

export const Button = forwardRef(function Button(
  {
    children,
    isLoading = false,
    loadingContent,
    disabled,
    variant: _variant,
    size: _size,
    ...props
  },
  ref,
) {
  return createElement(
    "button",
    {
      ...props,
      "aria-busy": isLoading || undefined,
      disabled: disabled || isLoading,
      ref,
      type: props.type ?? "button",
    },
    isLoading ? loadingContent : children,
  );
});

export const Card = forwardRef(function Card(
  {
    children,
    title,
    subtitle,
    variant: _variant,
    padding: _padding,
    ...props
  },
  ref,
) {
  return createElement(
    "div",
    { ...props, ref },
    title ? createElement("h3", null, title) : null,
    subtitle ? createElement("p", null, subtitle) : null,
    children,
  );
});
