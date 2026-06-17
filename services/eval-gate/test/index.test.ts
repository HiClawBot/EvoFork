import { describe, expect, it } from "vitest";
import { validateManifest } from "@evofork/manifest-parser";
import {
  createEvalInputFromFixture,
  evaluatePatchBoundary,
  evaluateSecurityPolicy,
  listSafetyFixtures,
  runEvalGate,
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
      allowed_changes: ["copy"],
      forbidden_changes: ["payment_logic"],
      rollout: {
        max_auto_percentage: 5,
        require_human_approval: true
      }
    }
  ]
});

describe(serviceId, () => {
  it("passes patch-boundary checks for a manifest surface file", () => {
    const result = evaluatePatchBoundary({
      manifest,
      surfaceId: "pricing.hero",
      changedFiles: ["apps/demo-nextjs/src/app/pricing/PricingHero.tsx"]
    });

    expect(result).toMatchObject({
      name: "patch_boundary",
      passed: true
    });
  });

  it("fails patch-boundary checks for unauthorized files", () => {
    const result = evaluatePatchBoundary({
      manifest,
      surfaceId: "pricing.hero",
      changedFiles: ["apps/demo-nextjs/src/app/billing/Checkout.tsx"]
    });

    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("Unauthorized file");
  });

  it("fails security policy checks for forbidden paths and diff content", () => {
    const result = evaluateSecurityPolicy({
      manifest,
      changedFiles: [".env.local"],
      diff: "+OPENAI_API_KEY=secret"
    });

    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("secrets");
  });

  it("allows explicitly approved high-risk categories without hiding other violations", () => {
    const allowed = evaluateSecurityPolicy({
      manifest,
      changedFiles: ["packages/db/migrations/0001_initial.sql"],
      allowedSecurityCategories: ["database_schema"]
    });
    const stillBlocked = evaluateSecurityPolicy({
      manifest,
      changedFiles: ["packages/db/migrations/0001_initial.sql", ".env.local"],
      allowedSecurityCategories: ["database_schema"]
    });

    expect(allowed.passed).toBe(true);
    expect(stillBlocked.passed).toBe(false);
    expect(stillBlocked.details.join("\n")).toContain("secrets");
  });

  it("creates a failed JSON-style eval report when checks fail", () => {
    const report = runEvalGate({
      manifest,
      surfaceId: "pricing.hero",
      changedFiles: ["apps/demo-nextjs/src/app/billing/Checkout.tsx"]
    });

    expect(report.status).toBe("failed");
    expect(report.checks.patch_boundary).toBe(false);
    expect(report.failures).toContain("patch_boundary");
    expect(report.recommendation).toBe("blocked_until_failures_resolved");
  });

  it("runs bundled safety fixtures with expected eval outcomes", () => {
    const fixtures = listSafetyFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "pricing-copy-allowed",
      "payment-logic-blocked",
      "database-schema-blocked",
      "prompt-injection-feedback-is-data"
    ]);

    for (const fixture of fixtures) {
      const report = runEvalGate(createEvalInputFromFixture(manifest, fixture));

      expect(report.status, fixture.id).toBe(fixture.expected.evalStatus);
      expect([...report.failures].sort(), fixture.id).toEqual(
        [...fixture.expected.failedChecks].sort()
      );
    }
  });
});
