import { describe, expect, it } from "vitest";
import { copy, loopSteps } from "../src/content.js";

describe("website content", () => {
  it("keeps public copy bilingual", () => {
    for (const localized of Object.values(copy)) {
      expect(localized.en).toBeTruthy();
      expect(localized.zh).toBeTruthy();
    }
  });

  it("covers the trusted loop without adding deploy or merge steps", () => {
    expect(loopSteps.map((step) => step.id)).toEqual([
      "signal",
      "rfc",
      "patch",
      "eval",
      "branch",
      "route"
    ]);
  });

  it("keeps scenario copy outside the static content module", () => {
    expect(Object.keys(copy)).not.toContain("pricing.hero");
  });
});
