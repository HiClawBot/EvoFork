import { describe, expect, it } from "vitest";
import {
  assertSurfacePathAllowed,
  findSurface,
  listSurfaces,
  loadManifest,
  moduleId,
  validateManifest,
  type EvoManifest
} from "../src/index.js";

describe(moduleId, () => {
  it("loads and validates the example manifest", async () => {
    const manifest = await loadManifest(new URL("../../../evo.manifest.example.yaml", import.meta.url).pathname);

    expect(manifest.app.id).toBe("demo-saas");
    expect(listSurfaces(manifest)).toHaveLength(3);
    expect(findSurface(manifest, "pricing.hero")?.path).toBe(
      "apps/demo-nextjs/src/app/pricing/PricingHero.tsx"
    );
  });

  it("validates a manifest and lists surfaces", () => {
    const manifest = validateManifest(validManifest());

    expect(listSurfaces(manifest).map((surface) => surface.id)).toEqual(["pricing.hero"]);
    expect(findSurface(manifest, "pricing.hero")?.owner).toBe("growth-team");
    expect(findSurface(manifest, "missing.surface")).toBeUndefined();
  });

  it("rejects duplicate surface ids", () => {
    const manifest = validManifest({
      surfaces: [validSurface(), validSurface({ path: "apps/demo-nextjs/src/Other.tsx" })]
    });

    expect(() => validateManifest(manifest)).toThrow("Duplicate surface id: pricing.hero");
  });

  it("rejects missing required fields", () => {
    const manifest = validManifest();
    delete (manifest.surfaces[0] as Partial<(typeof manifest.surfaces)[number]>).owner;

    expect(() => validateManifest(manifest)).toThrow();
  });

  it("rejects manifest paths that escape the repository root", () => {
    const manifest = validManifest({
      surfaces: [validSurface({ path: "../secrets.ts" })]
    });

    expect(() => validateManifest(manifest)).toThrow("Path must not escape the repository root");
  });

  it("allows patches that only change the declared surface path", () => {
    const manifest = validateManifest(validManifest());

    expect(() =>
      assertSurfacePathAllowed(manifest, "pricing.hero", [
        "apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
        { path: "apps/demo-nextjs/src/app/pricing/PricingHero.tsx" }
      ])
    ).not.toThrow();
  });

  it("rejects changed files outside the declared surface path", () => {
    const manifest = validateManifest(validManifest());

    expect(() =>
      assertSurfacePathAllowed(manifest, "pricing.hero", [
        "apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
        "apps/demo-nextjs/src/app/pricing/Billing.tsx"
      ])
    ).toThrow("Unauthorized file for surface pricing.hero");
  });

  it("rejects unknown surfaces in boundary checks", () => {
    const manifest = validateManifest(validManifest());

    expect(() =>
      assertSurfacePathAllowed(manifest, "missing.surface", [
        "apps/demo-nextjs/src/app/pricing/PricingHero.tsx"
      ])
    ).toThrow("Unknown surface id: missing.surface");
  });
});

function validManifest(overrides: Partial<EvoManifest> = {}): EvoManifest {
  return {
    app: {
      id: "demo-saas",
      name: "Demo SaaS",
      default_branch: "main"
    },
    surfaces: [validSurface()],
    ...overrides
  };
}

function validSurface(overrides: Partial<EvoManifest["surfaces"][number]> = {}): EvoManifest["surfaces"][number] {
  return {
    id: "pricing.hero",
    type: "react-component",
    path: "apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
    owner: "growth-team",
    allowed_changes: ["copy", "layout", "cta_text"],
    forbidden_changes: ["payment_logic", "authentication", "database_schema"],
    target_metrics: {
      primary: "pricing_to_signup_conversion",
      guardrails: ["page_error_rate", "support_ticket_rate"]
    },
    rollout: {
      max_auto_percentage: 5,
      require_human_approval: true
    },
    ...overrides
  };
}
