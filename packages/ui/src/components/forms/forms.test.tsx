import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "./Field";
import { Label } from "./Label";

describe("Field and Label", () => {
  it("associates Field labels with their control", () => {
    render(
      <Field id="channel" label="Channel">
        <input id="channel" />
      </Field>,
    );

    expect(screen.getByLabelText("Channel")).toBeInTheDocument();
  });

  it("prioritizes Field errors over helper text", () => {
    render(
      <Field
        id="channel"
        helperText="Helper"
        errorText="Invalid channel"
      >
        <input id="channel" />
      </Field>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid channel",
    );
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
  });

  it("supports a reusable required Label", () => {
    render(
      <>
        <Label htmlFor="name" required>
          Name
        </Label>
        <input id="name" required />
      </>,
    );

    expect(screen.getByLabelText(/Name/)).toBeRequired();
  });
});
