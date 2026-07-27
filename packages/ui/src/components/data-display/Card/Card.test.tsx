import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./Card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Channel overview</Card>);

    expect(screen.getByText("Channel overview")).toBeInTheDocument();
  });

  it("composes an optional title and subtitle", () => {
    render(
      <Card title="Channel" subtitle="Last 28 days">
        Metrics
      </Card>,
    );

    expect(
      screen.getByRole("heading", { name: "Channel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Last 28 days")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
  });

  it("forwards its ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>Content</Card>);

    expect(ref.current).toHaveTextContent("Content");
  });

  it("propagates native attributes", () => {
    render(
      <Card aria-label="Overview" data-testid="overview">
        Content
      </Card>,
    );

    expect(screen.getByTestId("overview")).toHaveAttribute(
      "aria-label",
      "Overview",
    );
  });

  it.each(["default", "elevated", "interactive", "highlighted"] as const)(
    "supports the %s variant",
    (variant) => {
      render(
        <Card data-testid="card" variant={variant}>
          {variant}
        </Card>,
      );

      expect(screen.getByTestId("card")).toHaveClass(
        new RegExp(variant),
      );
    },
  );

  it.each(["none", "sm", "md", "lg"] as const)(
    "supports %s padding",
    (padding) => {
      render(
        <Card data-testid="card" padding={padding}>
          {padding}
        </Card>,
      );

      expect(screen.getByTestId("card").className).toContain(
        `padding-${padding}`,
      );
    },
  );

  it("merges a custom class name", () => {
    render(
      <Card data-testid="card" className="consumer-card">
        Content
      </Card>,
    );

    expect(screen.getByTestId("card")).toHaveClass(
      "consumer-card",
    );
  });

  it("keeps the interactive variant visually interactive but semantically neutral", () => {
    render(
      <Card data-testid="card" variant="interactive">
        Open
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).not.toHaveAttribute("role");
    expect(card).not.toHaveAttribute("tabindex");
  });
});
