import { describe, expect, it } from "vitest";
import { validateManifest } from "@evofork/manifest-parser";
import {
  evaluatePolicy,
  getGloballyBlockedChanges,
  serviceId
} from "../src/index.js";

const manifest = validateManifest({
  app: {
    id: "demo-saas",
    default_branch: "main"
  },
  surfaces: [
    {
      id: "pricing.hero",
      type: "react-component",
      path: "apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
      owner: "growth-team",
      allowed_changes: ["copy", "layout", "cta_text"],
      forbidden_changes: ["payment_logic", "authentication", "database_schema"],
      rollout: {
        max_auto_percentage: 5,
        require_human_approval: true
      }
    },
    {
      id: "docs.quickstart",
      type: "markdown-doc",
      path: "docs/quickstart.md",
      owner: "docs-team",
      allowed_changes: ["wording", "examples", "structure"],
      forbidden_changes: ["security_policy"],
      rollout: {
        max_auto_percentage: 25,
        require_human_approval: false
      }
    }
  ]
});

describe(serviceId, () => {
  it("allows manifest-approved change categories", () => {
    const decision = evaluatePolicy({
      manifest,
      surfaceId: "pricing.hero",
      action: "patch",
      changeCategories: ["copy"]
    });

    expect(decision.allowed).toBe(true);
    expect(decision.audit.event).toBe("policy_allowed");
  });

  it("blocks forbidden and globally blocked change categories", () => {
    const decision = evaluatePolicy({
      manifest,
      surfaceId: "pricing.hero",
      action: "patch",
      changeCategories: ["payment_logic"]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join("\n")).toContain("payment_logic");
    expect(getGloballyBlockedChanges()).toContain("database_schema");
  });

  it("blocks change categories not listed on the surface", () => {
    const decision = evaluatePolicy({
      manifest,
      surfaceId: "pricing.hero",
      action: "patch",
      changeCategories: ["field_order"]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join("\n")).toContain("not allowed");
  });

  it("requires human approval for guarded rollouts", () => {
    const blocked = evaluatePolicy({
      manifest,
      surfaceId: "pricing.hero",
      action: "rollout",
      rolloutPercentage: 10
    });
    const approved = evaluatePolicy({
      manifest,
      surfaceId: "pricing.hero",
      action: "rollout",
      rolloutPercentage: 10,
      humanApproved: true
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.requiredApprovals).toEqual(["human_approval", "rollout_approval"]);
    expect(approved.allowed).toBe(true);
  });

  it("blocks unknown surfaces", () => {
    const decision = evaluatePolicy({
      manifest,
      surfaceId: "missing.surface",
      action: "patch",
      changeCategories: ["copy"]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join("\n")).toContain("Unknown surface");
  });
});
