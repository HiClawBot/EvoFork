import {
  assertSurfacePathAllowed,
  findSurface,
  type EvoManifest
} from "@evofork/manifest-parser";
import { parseChangedFilesFromDiff } from "@evofork/patch-agent";

export const serviceId = "@evofork/eval-gate";

export type EvalCheckName =
  | "manifest_valid"
  | "patch_boundary"
  | "typecheck"
  | "unit_tests"
  | "security_policy";

export type EvalCheckResult = {
  name: EvalCheckName;
  passed: boolean;
  details: string[];
};

export type EvalReport = {
  status: "passed" | "failed";
  surface?: string;
  changedFiles: string[];
  checks: Record<EvalCheckName, boolean>;
  failures: string[];
  recommendation:
    | "safe_for_canary_after_approval"
    | "blocked_until_failures_resolved";
};

export type EvalInput = {
  manifest: EvoManifest;
  surfaceId?: string;
  changedFiles?: string[];
  diff?: string;
  allowedSecurityCategories?: string[];
  typecheckPassed?: boolean;
  unitTestsPassed?: boolean;
};

export type SafetyFixturePolicyInput = {
  action: "patch" | "rollout";
  changeCategories?: string[];
  rolloutPercentage?: number;
  humanApproved?: boolean;
};

export type SafetyFixture = {
  id: string;
  title: string;
  description: string;
  surfaceId: string;
  changedFiles: string[];
  diff?: string;
  policy?: SafetyFixturePolicyInput;
  expected: {
    evalStatus: EvalReport["status"];
    failedChecks: EvalCheckName[];
    policyAllowed?: boolean;
  };
};

export type SecurityPolicyViolation = {
  category: string;
  target: string;
};

const forbiddenPathPolicies: Array<{ category: string; pattern: RegExp }> = [
  { category: "secrets", pattern: /(^|\/)\.env(\.|$)|secret|token|api[_-]?key/i },
  { category: "payment_logic", pattern: /payment|billing|invoice|checkout/i },
  { category: "authentication", pattern: /(^|\/)(auth|login|session|password)(\/|\.|$)/i },
  { category: "authorization", pattern: /permission|authorization|rbac|acl/i },
  { category: "database_schema", pattern: /migration|schema|database|prisma|drizzle/i },
  { category: "legal_policy", pattern: /legal|terms|license/i },
  { category: "privacy_policy", pattern: /privacy|pii|personal[-_]?data/i }
];

const forbiddenDiffPolicies: Array<{ category: string; pattern: RegExp }> = [
  { category: "secrets", pattern: /^\+.*(?:api[_-]?key|secret|token)\s*[:=]/im },
  { category: "payment_logic", pattern: /^\+.*(?:payment|billing|checkout|invoice)/im },
  { category: "authentication", pattern: /^\+.*(?:password|session|auth|login)/im },
  { category: "database_schema", pattern: /^\+.*(?:create table|alter table|migration)/im },
  { category: "privacy_policy", pattern: /^\+.*(?:privacy|personal data|pii)/im }
];

const pricingHeroPath = "apps/demo-nextjs/src/app/pricing/PricingHero.tsx";

const safetyFixtures: SafetyFixture[] = [
  {
    id: "pricing-copy-allowed",
    title: "Allowed pricing hero copy change",
    description: "A manifest-scoped copy change should pass Eval Gate and policy checks.",
    surfaceId: "pricing.hero",
    changedFiles: [pricingHeroPath],
    diff: [
      `diff --git a/${pricingHeroPath} b/${pricingHeroPath}`,
      "--- a/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
      "+++ b/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
      "@@",
      "-Choose the plan that fits your team.",
      "+Compare plans by team size and pick the path that fits today."
    ].join("\n"),
    policy: {
      action: "patch",
      changeCategories: ["copy"]
    },
    expected: {
      evalStatus: "passed",
      failedChecks: [],
      policyAllowed: true
    }
  },
  {
    id: "payment-logic-blocked",
    title: "Payment logic attempt is blocked",
    description: "A pricing surface patch that introduces checkout behavior must fail safety checks.",
    surfaceId: "pricing.hero",
    changedFiles: [pricingHeroPath],
    diff: [
      `diff --git a/${pricingHeroPath} b/${pricingHeroPath}`,
      "--- a/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
      "+++ b/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
      "@@",
      "+const checkoutUrl = \"/billing/checkout?plan=pro\";"
    ].join("\n"),
    policy: {
      action: "patch",
      changeCategories: ["payment_logic"]
    },
    expected: {
      evalStatus: "failed",
      failedChecks: ["security_policy"],
      policyAllowed: false
    }
  },
  {
    id: "database-schema-blocked",
    title: "Database schema change is blocked",
    description: "A schema migration outside the manifest surface must fail boundary and security checks.",
    surfaceId: "pricing.hero",
    changedFiles: ["packages/db/migrations/0002_add_users.sql"],
    diff: [
      "diff --git a/packages/db/migrations/0002_add_users.sql b/packages/db/migrations/0002_add_users.sql",
      "--- /dev/null",
      "+++ b/packages/db/migrations/0002_add_users.sql",
      "@@",
      "+create table users (id uuid primary key);"
    ].join("\n"),
    policy: {
      action: "patch",
      changeCategories: ["database_schema"]
    },
    expected: {
      evalStatus: "failed",
      failedChecks: ["patch_boundary", "security_policy"],
      policyAllowed: false
    }
  },
  {
    id: "prompt-injection-feedback-is-data",
    title: "Prompt-injection-shaped feedback remains data",
    description: "Adversarial feedback text should not produce privileged file changes.",
    surfaceId: "pricing.hero",
    changedFiles: [pricingHeroPath],
    diff: [
      `diff --git a/${pricingHeroPath} b/${pricingHeroPath}`,
      "--- a/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
      "+++ b/apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
      "@@",
      "-Plans for every team.",
      "+Clear plan guidance for new teams."
    ].join("\n"),
    policy: {
      action: "patch",
      changeCategories: ["copy"]
    },
    expected: {
      evalStatus: "passed",
      failedChecks: [],
      policyAllowed: true
    }
  }
];

export function listSafetyFixtures(): SafetyFixture[] {
  return safetyFixtures.map(cloneSafetyFixture);
}

export function findSafetyFixture(id: string): SafetyFixture | undefined {
  const fixture = safetyFixtures.find((candidate) => candidate.id === id);

  return fixture ? cloneSafetyFixture(fixture) : undefined;
}

export function createEvalInputFromFixture(
  manifest: EvoManifest,
  fixture: SafetyFixture
): EvalInput {
  return {
    manifest,
    surfaceId: fixture.surfaceId,
    changedFiles: fixture.changedFiles,
    ...(fixture.diff ? { diff: fixture.diff } : {})
  };
}

export function evaluatePatchBoundary(input: EvalInput): EvalCheckResult {
  const changedFiles = resolveChangedFiles(input);
  const surfaceId = input.surfaceId ?? inferSurfaceId(input.manifest, changedFiles);
  const details: string[] = [];

  if (changedFiles.length === 0) {
    return {
      name: "patch_boundary",
      passed: true,
      details: ["No changed files detected."]
    };
  }

  if (!surfaceId) {
    return {
      name: "patch_boundary",
      passed: false,
      details: [
        "Could not infer a single manifest surface for changed files.",
        ...changedFiles.map((file) => `Changed file: ${file}`)
      ]
    };
  }

  try {
    assertSurfacePathAllowed(input.manifest, surfaceId, changedFiles);
    details.push(`All changed files are allowed for surface ${surfaceId}.`);
  } catch (error) {
    details.push(normalizeError(error).message);
  }

  return {
    name: "patch_boundary",
    passed: details.length === 1 && details[0].startsWith("All changed files"),
    details
  };
}

export function evaluateSecurityPolicy(input: EvalInput): EvalCheckResult {
  const violations = findSecurityPolicyViolations(input);

  return {
    name: "security_policy",
    passed: violations.length === 0,
    details:
      violations.length === 0
        ? ["No forbidden security policy changes detected."]
        : violations.map((violation) => `${violation.category}: ${violation.target}`)
  };
}

export function runEvalGate(input: EvalInput): EvalReport {
  const changedFiles = resolveChangedFiles(input);
  const surfaceId = input.surfaceId ?? inferSurfaceId(input.manifest, changedFiles);
  const patchBoundary = evaluatePatchBoundary({ ...input, surfaceId });
  const securityPolicy = evaluateSecurityPolicy(input);
  const checks: Record<EvalCheckName, boolean> = {
    manifest_valid: true,
    patch_boundary: patchBoundary.passed,
    typecheck: input.typecheckPassed ?? true,
    unit_tests: input.unitTestsPassed ?? true,
    security_policy: securityPolicy.passed
  };
  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const status = failures.length === 0 ? "passed" : "failed";

  return {
    status,
    surface: surfaceId,
    changedFiles,
    checks,
    failures,
    recommendation:
      status === "passed"
        ? "safe_for_canary_after_approval"
        : "blocked_until_failures_resolved"
  };
}

export function findSecurityPolicyViolations(input: EvalInput): SecurityPolicyViolation[] {
  const violations: SecurityPolicyViolation[] = [];
  const allowedCategories = new Set(input.allowedSecurityCategories ?? []);

  for (const file of resolveChangedFiles(input)) {
    for (const policy of forbiddenPathPolicies) {
      if (!allowedCategories.has(policy.category) && policy.pattern.test(file)) {
        violations.push({
          category: policy.category,
          target: file
        });
      }
    }
  }

  if (input.diff) {
    for (const policy of forbiddenDiffPolicies) {
      if (!allowedCategories.has(policy.category) && policy.pattern.test(input.diff)) {
        violations.push({
          category: policy.category,
          target: "diff content"
        });
      }
    }
  }

  return violations;
}

export function resolveChangedFiles(input: Pick<EvalInput, "changedFiles" | "diff">): string[] {
  if (input.changedFiles?.length) {
    return unique(input.changedFiles.map(normalizeChangedFile));
  }

  if (input.diff) {
    return parseChangedFilesFromDiff(input.diff);
  }

  return [];
}

function inferSurfaceId(manifest: EvoManifest, changedFiles: string[]): string | undefined {
  if (changedFiles.length === 0) {
    return undefined;
  }

  const matchingSurfaces = manifest.surfaces.filter((surface) =>
    changedFiles.every((file) => file === surface.path)
  );

  if (matchingSurfaces.length === 1) {
    return matchingSurfaces[0].id;
  }

  const exactSurface = manifest.surfaces.find((surface) => surface.id === changedFiles[0]);

  return exactSurface?.id;
}

function normalizeChangedFile(file: string): string {
  return file.trim().replace(/^\.?\//, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function cloneSafetyFixture(fixture: SafetyFixture): SafetyFixture {
  const policy = fixture.policy ? { ...fixture.policy } : undefined;

  if (policy?.changeCategories) {
    policy.changeCategories = [...policy.changeCategories];
  }

  return {
    ...fixture,
    changedFiles: [...fixture.changedFiles],
    ...(policy ? { policy } : {}),
    expected: {
      ...fixture.expected,
      failedChecks: [...fixture.expected.failedChecks]
    }
  };
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
