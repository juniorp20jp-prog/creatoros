import {
  Button,
  Card,
  Field,
  Input,
  Label,
} from "@repo/ui";
import { Button as ButtonSubpath } from "@repo/ui/button";
import { Card as CardSubpath } from "@repo/ui/card";
import { describe, expect, it } from "vitest";

describe("@repo/ui public API", () => {
  it("exports the active components from the package root", () => {
    expect(Button).toBeTypeOf("object");
    expect(Card).toBeTypeOf("object");
    expect(Input).toBeTypeOf("object");
    expect(Field).toBeTypeOf("function");
    expect(Label).toBeTypeOf("function");
  });

  it("keeps public subpaths aligned with the root API", () => {
    expect(ButtonSubpath).toBe(Button);
    expect(CardSubpath).toBe(Card);
  });
});
