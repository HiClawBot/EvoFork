import { describe, expect, it } from "vitest";
import { createElement, isValidElement } from "react";
import { EvoSlot, moduleId } from "../src/index.js";

describe(moduleId, () => {
  it("renders fallback when no variant is available", () => {
    const fallback = createElement("div", { id: "fallback" }, "Default hero");
    const rendered = EvoSlot({
      surface: "pricing.hero",
      variant: "default",
      fallback
    });

    expect(isValidElement(rendered)).toBe(true);
    expect(fragmentChildren(rendered)).toBe(fallback);
  });

  it("renders mapped variant content", () => {
    const fallback = createElement("div", { id: "fallback" }, "Default hero");
    const variant = createElement("div", { id: "clarity" }, "Clarity hero");
    const rendered = EvoSlot({
      surface: "pricing.hero",
      variant: "pricing.hero.new-user-clarity.v1",
      fallback,
      variants: {
        "pricing.hero.new-user-clarity.v1": variant
      }
    });

    expect(fragmentChildren(rendered)).toBe(variant);
  });

  it("renders fallback when variant content is missing", () => {
    const fallback = createElement("div", { id: "fallback" }, "Default hero");
    const rendered = EvoSlot({
      surface: "pricing.hero",
      variant: "pricing.hero.unknown.v1",
      fallback,
      variants: {}
    });

    expect(fragmentChildren(rendered)).toBe(fallback);
  });

  it("supports variant resolver functions", () => {
    const fallback = createElement("div", { id: "fallback" }, "Default hero");
    const rendered = EvoSlot({
      surface: "pricing.hero",
      variant: "pricing.hero.developer-focused.v1",
      fallback,
      variants: (variant, surface) =>
        createElement("div", { id: `${surface}:${variant}` }, "Developer hero")
    });

    const child = fragmentChildren(rendered);

    expect(isValidElement(child)).toBe(true);
    expect((child.props as { id: string }).id).toBe(
      "pricing.hero:pricing.hero.developer-focused.v1"
    );
  });
});

function fragmentChildren(element: ReturnType<typeof EvoSlot>): unknown {
  return (element.props as { children: unknown }).children;
}
