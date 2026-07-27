import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
    it("renders the label", () => {
        render(
            <Input
                label="Project Name"
                placeholder="Enter project name"
            />,
        );

        expect(
            screen.getByLabelText("Project Name"),
        ).toBeInTheDocument();
    });

    it("renders helper text", () => {
        render(
            <Input helperText="Helper text" />,
        );

        expect(
            screen.getByText("Helper text"),
        ).toBeInTheDocument();
    });

    it("renders error text", () => {
        render(
            <Input errorText="Invalid value" />,
        );

        expect(
            screen.getByRole("alert"),
        ).toHaveTextContent("Invalid value");
    });

    it("supports disabled state", () => {
        render(<Input disabled />);

        expect(
            screen.getByRole("textbox"),
        ).toBeDisabled();
    });

    it("supports readOnly state", () => {
        render(<Input readOnly />);

        expect(
            screen.getByRole("textbox"),
        ).toHaveAttribute("readonly");
    });

    it("supports required state", () => {
        render(
            <Input
                required
                label="Email"
            />,
        );

        expect(
            screen.getByRole("textbox", {
                name: /Email/i,
            }),
        ).toBeRequired();
    });

    it("does not render an optional label by default", () => {
        render(<Input label="Website" />);

        expect(
            screen.queryByText("Optional"),
        ).not.toBeInTheDocument();
    });

    it("renders configurable optional text", () => {
        render(
            <Input
                label="Website"
                optionalText="Optional field"
            />,
        );

        expect(
            screen.getByText("Optional field"),
        ).toBeInTheDocument();
    });

    it("associates helper text through aria-describedby", () => {
        render(
            <Input
                label="Project"
                helperText="Use a unique name"
            />,
        );

        const input = screen.getByRole("textbox", {
            name: "Project",
        });
        const helper = screen.getByText(
            "Use a unique name",
        );

        expect(input).toHaveAttribute(
            "aria-describedby",
            helper.id,
        );
    });

    it("associates errors and marks the input invalid", () => {
        render(
            <Input
                label="Project"
                errorText="Project is required"
            />,
        );

        const input = screen.getByRole("textbox", {
            name: "Project",
        });
        const error = screen.getByRole("alert");

        expect(input).toHaveAttribute(
            "aria-describedby",
            error.id,
        );
        expect(input).toHaveAttribute(
            "aria-invalid",
            "true",
        );
    });

    it("forwards its ref", () => {
        const ref = createRef<HTMLInputElement>();
        render(<Input ref={ref} aria-label="Channel" />);

        expect(ref.current).toBe(
            screen.getByRole("textbox", {
                name: "Channel",
            }),
        );
    });

    it("propagates native input attributes", () => {
        render(
            <Input
                aria-label="Email"
                name="email"
                type="email"
                autoComplete="email"
            />,
        );

        const input = screen.getByRole("textbox", {
            name: "Email",
        });
        expect(input).toHaveAttribute("name", "email");
        expect(input).toHaveAttribute("type", "email");
        expect(input).toHaveAttribute(
            "autocomplete",
            "email",
        );
    });

    it("merges custom input and container classes", () => {
        render(
            <Input
                aria-label="Channel"
                className="native-class"
                inputClassName="input-class"
                containerClassName="container-class"
            />,
        );

        const input = screen.getByRole("textbox");
        expect(input).toHaveClass(
            "native-class",
            "input-class",
        );
        expect(
            input.closest(".container-class"),
        ).toBeInTheDocument();
    });
});
