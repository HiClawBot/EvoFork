import { describe, expect, it } from "vitest";
import {
  assertPatchBoundary,
  checkPatchBoundary,
  parseChangedFilesFromDiff,
  preparePullRequest,
  serviceId
} from "../src/index.js";

describe(serviceId, () => {
  it("parses changed files from git diffs", () => {
    expect(
      parseChangedFilesFromDiff(
        [
          "diff --git a/apps/demo-nextjs/src/app/pricing/PricingHero.tsx b/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
          "diff --git a/README.md b/README.md"
        ].join("\n")
      )
    ).toEqual(["apps/demo-nextjs/src/app/pricing/PricingHero.tsx", "README.md"]);
  });

  it("allows patches scoped to the manifest surface path", () => {
    const report = assertPatchBoundary({
      diff: validDiff(),
      manifest: manifest(),
      surfaceId: "pricing.hero"
    });

    expect(report.allowed).toBe(true);
    expect(report.changedFiles).toEqual([
      "apps/demo-nextjs/src/app/pricing/PricingHero.tsx"
    ]);
  });

  it("rejects patches outside the manifest surface path", () => {
    const report = checkPatchBoundary({
      diff: [
        "diff --git a/apps/demo-nextjs/src/app/pricing/PricingHero.tsx b/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
        "diff --git a/apps/demo-nextjs/src/app/auth/Login.tsx b/apps/demo-nextjs/src/app/auth/Login.tsx"
      ].join("\n"),
      manifest: manifest(),
      surfaceId: "pricing.hero"
    });

    expect(report.allowed).toBe(false);
    expect(report.errors.join("\n")).toContain("Unauthorized file for surface pricing.hero");
  });

  it("rejects forbidden path patterns", () => {
    const report = checkPatchBoundary({
      diff: "diff --git a/apps/demo-nextjs/src/app/auth/Login.tsx b/apps/demo-nextjs/src/app/auth/Login.tsx",
      manifest: manifest({
        path: "apps/demo-nextjs/src/app/auth/Login.tsx"
      }),
      surfaceId: "pricing.hero"
    });

    expect(report.allowed).toBe(false);
    expect(report.errors.join("\n")).toContain("Forbidden path pattern matched");
  });

  it("prepares local PR output without GitHub credentials", () => {
    const prepared = preparePullRequest({
      manifest: manifest(),
      rfc: {
        rfcId: "rfc_pricing_clarity_001",
        surfaceId: "pricing.hero",
        problem: "New users do not understand Basic vs Pro.",
        hypothesis: "Clearer copy improves conversion.",
        proposedChanges: ["rewrite hero copy"],
        targetMetric: "pricing_to_signup_conversion",
        guardrailMetrics: ["page_error_rate"],
        risk: "low",
        evidenceCount: 12
      }
    });

    expect(prepared.branchName).toBe("pricing.hero.new-user-clarity.v1");
    expect(prepared.body).toContain("## Manifest Boundary");
    expect(prepared.boundary.allowed).toBe(true);
  });
});

function validDiff(): string {
  return "diff --git a/apps/demo-nextjs/src/app/pricing/PricingHero.tsx b/apps/demo-nextjs/src/app/pricing/PricingHero.tsx";
}

function manifest(surfaceOverrides: Record<string, unknown> = {}) {
  return {
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
        ...surfaceOverrides
      }
    ]
  } as const;
}
