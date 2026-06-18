import { describe, expect, it } from "vitest";
import { copy, loopSteps, scenarios } from "../src/content.js";

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

  it("previews application scenarios with manifest surfaces and safe branch names", () => {
    expect(scenarios).toHaveLength(3);

    for (const scenario of scenarios) {
      expect(scenario.surfaceId).toContain(".");
      expect(scenario.branch.startsWith(`${scenario.surfaceId}.`)).toBe(true);
      expect(scenario.evalGate.en.toLowerCase()).toContain("blocked");
      expect(scenario.evalGate.zh).toContain("阻止");
      expect(scenario.metric).toMatch(/^[a-z0-9_]+$/);
    }
  });
});
