import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders accessible content", () => {
    render(<Button>Analyze</Button>);

    expect(
      screen.getByRole("button", { name: "Analyze" }),
    ).toBeInTheDocument();
  });

  it("handles clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Analyze</Button>);

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("prevents interaction when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Analyze
      </Button>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("prevents interaction while loading and supports custom content", () => {
    const onClick = vi.fn();
    render(
      <Button
        isLoading
        loadingContent="Saving"
        onClick={onClick}
      >
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving" });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards its ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Analyze</Button>);

    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("propagates native attributes", () => {
    render(
      <Button name="action" value="analyze" data-testid="action">
        Analyze
      </Button>,
    );

    const button = screen.getByTestId("action");
    expect(button).toHaveAttribute("name", "action");
    expect(button).toHaveAttribute("value", "analyze");
  });

  it.each(["primary", "secondary", "ghost", "danger", "outline"] as const)(
    "supports the %s variant",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);

      expect(screen.getByRole("button")).toHaveClass(
        new RegExp(variant),
      );
    },
  );

  it.each(["sm", "md", "lg", "small", "medium", "large"] as const)(
    "supports the %s size",
    (size) => {
      render(<Button size={size}>{size}</Button>);

      expect(screen.getByRole("button").className).toMatch(
        /(?:sm|md|lg)/,
      );
    },
  );

  it("merges a custom class name", () => {
    render(<Button className="consumer-class">Analyze</Button>);

    expect(screen.getByRole("button")).toHaveClass("consumer-class");
  });

  it("uses type button by default and preserves an explicit submit type", () => {
    const { rerender } = render(<Button>Default</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");

    rerender(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
