import { describe, expect, it } from "vitest";
import {
  appId,
  pricingHeroCopy,
  pricingPlans,
  toPricingVariant
} from "../src/index.js";

describe(appId, () => {
  it("maps unknown variants to default pricing copy", () => {
    expect(toPricingVariant(undefined)).toBe("default");
    expect(toPricingVariant("unknown")).toBe("default");
  });

  it("includes the new-user clarity variant required by the MVP", () => {
    const variant = toPricingVariant("pricing.hero.new-user-clarity.v1");

    expect(variant).toBe("pricing.hero.new-user-clarity.v1");
    expect(pricingHeroCopy[variant].headline).toContain("Basic");
    expect(pricingHeroCopy[variant].headline).toContain("Pro");
  });

  it("ships the three demo pricing plans", () => {
    expect(pricingPlans.map((plan) => plan.name)).toEqual([
      "Basic",
      "Pro",
      "Enterprise"
    ]);
  });
});
