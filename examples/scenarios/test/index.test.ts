import { describe, expect, it } from "vitest";
import {
  loadScenarioModelsFromDirectory,
  toPublicScenarioPreviews,
  validateScenarioModel
} from "../src/index.js";

describe("scenario models", () => {
  it("loads the bundled application scenario fixtures", async () => {
    const models = await loadScenarioModelsFromDirectory("fixtures");

    expect(models.map((model) => model.id)).toEqual([
      "pricing-hero",
      "docs-quickstart",
      "support-refund-answer"
    ]);
  });

  it("validates manifest-like boundaries and safe branch names", async () => {
    const models = await loadScenarioModelsFromDirectory("fixtures");

    for (const model of models) {
      expect(model.surfaceId).toContain(".");
      expect(model.branch.startsWith(`${model.surfaceId}.`)).toBe(true);
      expect(model.allowedChanges.length).toBeGreaterThan(0);
      expect(
        model.blockedChanges.some((change) =>
          ["payment_logic", "legal_claim", "security_policy", "policy_change"].includes(change)
        )
      ).toBe(true);
      expect(model.demoFlow.map((step) => step.id)).toEqual([
        "signal",
        "rfc",
        "eval",
        "route"
      ]);
    }
  });

  it("projects public previews for the website without exposing internal fixture paths", async () => {
    const previews = toPublicScenarioPreviews(await loadScenarioModelsFromDirectory("fixtures"));

    expect(previews).toHaveLength(3);
    expect(previews[0]).not.toHaveProperty("blockedChanges");
    expect(previews[0]?.steps).toHaveLength(4);
  });

  it("rejects malformed scenario records", () => {
    expect(() => validateScenarioModel({ id: "bad" })).toThrow(/schemaVersion/);
  });
});
