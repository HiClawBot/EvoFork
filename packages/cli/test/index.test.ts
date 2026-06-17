import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/index.js";

describe("@evofork/cli", () => {
  const manifestPath = fileURLToPath(
    new URL("../../../evo.manifest.example.yaml", import.meta.url)
  );

  it("prints help", async () => {
    const io = createTestIo();

    await expect(runCli(["--help"], io)).resolves.toBe(0);

    expect(io.output()).toContain("EvoFork CLI");
    expect(io.output()).toContain("evo manifest validate");
    expect(io.output()).toContain("evo db status");
    expect(io.output()).toContain("evo policy check");
    expect(io.output()).toContain("evo eval fixture");
    expect(io.output()).toContain("evo eval patch-boundary");
  });

  it("validates a manifest file", async () => {
    const io = createTestIo();

    await expect(
      runCli(["manifest", "validate", "--manifest", manifestPath], io)
    ).resolves.toBe(0);

    expect(io.output()).toContain(`Manifest valid: ${manifestPath}`);
    expect(io.output()).toContain("App: demo-saas");
    expect(io.output()).toContain("Surfaces: 3");
  });

  it("lists manifest surfaces", async () => {
    const io = createTestIo();

    await expect(runCli(["surface", "list", "-m", manifestPath], io)).resolves.toBe(0);

    expect(io.output()).toContain("pricing.hero\treact-component");
    expect(io.output()).toContain("onboarding.signup\treact-component");
    expect(io.output()).toContain("docs.quickstart\tmarkdown-doc");
  });

  it("explains a manifest surface", async () => {
    const io = createTestIo();

    await expect(
      runCli(["surface", "explain", "pricing.hero", "--manifest", manifestPath], io)
    ).resolves.toBe(0);

    expect(io.output()).toContain("Surface: pricing.hero");
    expect(io.output()).toContain("Allowed changes: copy, layout, cta_text");
    expect(io.output()).toContain("Forbidden changes: payment_logic");
  });

  it("returns a non-zero exit code for missing surfaces", async () => {
    const io = createTestIo();

    await expect(
      runCli(["surface", "explain", "missing.surface", "--manifest", manifestPath], io)
    ).resolves.toBe(1);

    expect(io.errorOutput()).toContain("Surface not found: missing.surface");
  });

  it("generates RFCs with the mock insight path", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "insight",
          "generate",
          "--surface",
          "pricing.hero",
          "--text",
          "Basic vs Pro is unclear.",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const rfc = JSON.parse(io.output()) as { rfcId: string; surfaceId: string };

    expect(rfc).toMatchObject({
      rfcId: "rfc_pricing_clarity_001",
      surfaceId: "pricing.hero"
    });
  });

  it("prepares local PR output without GitHub credentials", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "patch",
          "create-pr",
          "--rfc",
          "rfc_pricing_clarity_001",
          "--surface",
          "pricing.hero",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const prepared = JSON.parse(io.output()) as { branchName: string; body: string };

    expect(prepared.branchName).toBe("pricing.hero.new-user-clarity.v1");
    expect(prepared.body).toContain("## Manifest Boundary");
  });

  it("checks policy decisions for allowed surface changes", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "policy",
          "check",
          "--surface",
          "pricing.hero",
          "--change",
          "copy",
          "--manifest",
          manifestPath,
          "--json"
        ],
        io
      )
    ).resolves.toBe(0);

    const decision = JSON.parse(io.output()) as { allowed: boolean };
    expect(decision.allowed).toBe(true);
  });

  it("blocks policy decisions for forbidden changes", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "policy",
          "check",
          "--surface",
          "pricing.hero",
          "--change",
          "payment_logic",
          "--manifest",
          manifestPath,
          "--json"
        ],
        io
      )
    ).resolves.toBe(1);

    const decision = JSON.parse(io.output()) as { allowed: boolean; reasons: string[] };
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join("\n")).toContain("payment_logic");
  });

  it("requires approval for guarded rollout policy decisions", async () => {
    const blockedIo = createTestIo();
    const approvedIo = createTestIo();

    await expect(
      runCli(
        [
          "policy",
          "check",
          "--surface",
          "pricing.hero",
          "--rollout",
          "10",
          "--manifest",
          manifestPath,
          "--json"
        ],
        blockedIo
      )
    ).resolves.toBe(1);
    await expect(
      runCli(
        [
          "policy",
          "check",
          "--surface",
          "pricing.hero",
          "--rollout",
          "10",
          "--approved",
          "--manifest",
          manifestPath,
          "--json"
        ],
        approvedIo
      )
    ).resolves.toBe(0);

    const blocked = JSON.parse(blockedIo.output()) as { requiredApprovals: string[] };
    const approved = JSON.parse(approvedIo.output()) as { allowed: boolean };
    expect(blocked.requiredApprovals).toContain("human_approval");
    expect(approved.allowed).toBe(true);
  });

  it("seeds deterministic demo signals", async () => {
    const io = createTestIo();
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-seed-")), "seed.json");

    await expect(
      runCli(
        [
          "demo",
          "seed",
          "--surface",
          "pricing.hero",
          "--count",
          "3",
          "--output",
          outputPath,
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const seed = JSON.parse(await readFile(outputPath, "utf8")) as {
      surfaceId: string;
      signals: Array<{ id: string; piiRemoved: boolean; llmEligible: boolean }>;
      branches: Array<{ id: string; branchName: string; status: string }>;
      auditLogs: Array<{ event: string; resourceId: string }>;
    };

    expect(io.output()).toContain("Seeded 3 demo signals");
    expect(seed.surfaceId).toBe("pricing.hero");
    expect(seed.signals).toHaveLength(3);
    expect(seed.signals[0]).toMatchObject({
      id: "demo_signal_001",
      piiRemoved: true,
      llmEligible: true
    });
    expect(seed.branches[0]).toMatchObject({
      id: "br_demo_seed",
      branchName: "pricing.hero.new-user-clarity.v1",
      status: "active"
    });
    expect(seed.auditLogs.map((log) => log.event)).toEqual([
      "branch_created",
      "branch_approved",
      "branch_rollout_changed"
    ]);
  });

  it("tests route matching from the CLI", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "route",
          "test",
          "pricing.hero",
          "--user",
          "user_123",
          "--segment",
          "lifecycle_stage=new_user",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    expect(io.output()).toContain("Matched branch: pricing.hero.new-user-clarity.v1");
    expect(io.output()).toContain("Reason: matched_segment_and_rollout");
    expect(io.output()).toContain("Sticky: true");
  });

  it("prints route test JSON and supports opt-out fallback", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "route",
          "test",
          "pricing.hero",
          "--user",
          "user_123",
          "--segment",
          "lifecycle_stage=new_user",
          "--opt-out",
          "--json",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const result = JSON.parse(io.output()) as { variant: string; reason: string; sticky: boolean };

    expect(result).toMatchObject({
      variant: "default",
      reason: "personalization_opt_out",
      sticky: false
    });
  });

  it("tests route matching from a branch fixture", async () => {
    const seedIo = createTestIo();
    const routeIo = createTestIo();
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-route-seed-")), "seed.json");

    await expect(
      runCli(
        [
          "demo",
          "seed",
          "--output",
          outputPath,
          "--count",
          "2",
          "--manifest",
          manifestPath
        ],
        seedIo
      )
    ).resolves.toBe(0);

    await expect(
      runCli(
        [
          "route",
          "test",
          "pricing.hero",
          "--user",
          "user_123",
          "--segment",
          "lifecycle_stage=new_user",
          "--branches",
          outputPath,
          "--manifest",
          manifestPath
        ],
        routeIo
      )
    ).resolves.toBe(0);

    expect(routeIo.output()).toContain("Matched branch: pricing.hero.new-user-clarity.v1");
    expect(routeIo.output()).toContain("Reason: matched_segment_and_rollout");
  });

  it("lists local branch fixtures", async () => {
    const seedIo = createTestIo();
    const listIo = createTestIo();
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-branch-list-")), "seed.json");

    await expect(
      runCli(["demo", "seed", "--output", outputPath, "--manifest", manifestPath], seedIo)
    ).resolves.toBe(0);

    await expect(
      runCli(["branch", "list", "--state", outputPath, "--surface", "pricing.hero"], listIo)
    ).resolves.toBe(0);

    expect(listIo.output()).toContain("br_demo_seed\tpricing.hero\tactive\t100%");
    expect(listIo.output()).toContain("pricing.hero.new-user-clarity.v1");
  });

  it("creates draft local branch fixtures", async () => {
    const io = createTestIo();
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-branch-create-")), "seed.json");

    await expect(
      runCli(
        [
          "branch",
          "create",
          "--surface",
          "pricing.hero",
          "--branch",
          "pricing.hero.local-draft.v1",
          "--segment",
          "lifecycle_stage=new_user",
          "--state",
          outputPath,
          "--json",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const output = JSON.parse(io.output()) as {
      branch: { id: string; status: string; branchName: string; rolloutPercentage: number };
      auditLog: { event: string };
    };
    const state = JSON.parse(await readFile(outputPath, "utf8")) as {
      branches: Array<{ id: string; status: string; branchName: string }>;
      auditLogs: Array<{ event: string }>;
    };

    expect(output.branch).toMatchObject({
      id: "br_local_001",
      status: "draft",
      branchName: "pricing.hero.local-draft.v1",
      rolloutPercentage: 0
    });
    expect(output.auditLog.event).toBe("branch_created");
    expect(state.branches[0]).toMatchObject({
      id: "br_local_001",
      status: "draft"
    });
    expect(state.auditLogs[0].event).toBe("branch_created");
  });

  it("approves and rolls out draft local branch fixtures", async () => {
    const approveIo = createTestIo();
    const rolloutIo = createTestIo();
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-branch-rollout-")), "seed.json");

    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          branches: [
            {
              id: "br_draft",
              appId: "demo-saas",
              surfaceId: "pricing.hero",
              branchName: "pricing.hero.new-user-clarity.v1",
              status: "draft",
              targetSegments: {
                lifecycle_stage: "new_user"
              },
              rolloutPercentage: 0,
              priority: 10
            }
          ],
          auditLogs: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await expect(
      runCli(
        [
          "branch",
          "approve",
          "br_draft",
          "--state",
          outputPath,
          "--actor",
          "maintainer",
          "--json"
        ],
        approveIo
      )
    ).resolves.toBe(0);

    const approved = JSON.parse(approveIo.output()) as {
      branch: { status: string; approvedBy: string };
      auditLog: { event: string };
    };
    expect(approved.branch.status).toBe("canary");
    expect(approved.branch.approvedBy).toBe("maintainer");
    expect(approved.auditLog.event).toBe("branch_approved");

    await expect(
      runCli(
        [
          "branch",
          "rollout",
          "br_draft",
          "--percentage",
          "25",
          "--state",
          outputPath,
          "--actor",
          "maintainer",
          "--approved",
          "--manifest",
          manifestPath,
          "--json"
        ],
        rolloutIo
      )
    ).resolves.toBe(0);

    const state = JSON.parse(await readFile(outputPath, "utf8")) as {
      branches: Array<{ status: string; rolloutPercentage: number }>;
      auditLogs: Array<{ event: string }>;
    };
    const rollout = JSON.parse(rolloutIo.output()) as {
      policyAuditLog: { event: string };
      auditLog: { event: string };
    };

    expect(state.branches[0]).toMatchObject({
      status: "canary",
      rolloutPercentage: 25
    });
    expect(rollout.policyAuditLog.event).toBe("policy_allowed");
    expect(rollout.auditLog.event).toBe("branch_rollout_changed");
    expect(state.auditLogs.map((log) => log.event)).toEqual([
      "branch_approved",
      "policy_allowed",
      "branch_rollout_changed"
    ]);
  });

  it("blocks local branch rollout when manifest policy requires approval", async () => {
    const approveIo = createTestIo();
    const rolloutIo = createTestIo();
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-branch-policy-")), "seed.json");

    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          branches: [
            {
              id: "br_policy",
              appId: "demo-saas",
              surfaceId: "pricing.hero",
              branchName: "pricing.hero.new-user-clarity.v1",
              status: "draft",
              targetSegments: {
                lifecycle_stage: "new_user"
              },
              rolloutPercentage: 0,
              priority: 10
            }
          ],
          auditLogs: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await expect(
      runCli(
        [
          "branch",
          "approve",
          "br_policy",
          "--state",
          outputPath,
          "--actor",
          "maintainer",
          "--json"
        ],
        approveIo
      )
    ).resolves.toBe(0);

    await expect(
      runCli(
        [
          "branch",
          "rollout",
          "br_policy",
          "--percentage",
          "25",
          "--state",
          outputPath,
          "--actor",
          "maintainer",
          "--manifest",
          manifestPath,
          "--json"
        ],
        rolloutIo
      )
    ).resolves.toBe(1);

    const output = JSON.parse(rolloutIo.output()) as {
      policyDecision: { allowed: boolean; requiredApprovals: string[] };
      auditLog: { event: string };
    };
    const state = JSON.parse(await readFile(outputPath, "utf8")) as {
      branches: Array<{ status: string; rolloutPercentage: number }>;
      auditLogs: Array<{ event: string }>;
    };

    expect(output.policyDecision.allowed).toBe(false);
    expect(output.policyDecision.requiredApprovals).toContain("human_approval");
    expect(output.auditLog.event).toBe("policy_blocked");
    expect(state.branches[0]).toMatchObject({
      status: "canary",
      rolloutPercentage: 0
    });
    expect(state.auditLogs.map((log) => log.event)).toEqual([
      "branch_approved",
      "policy_blocked"
    ]);
  });

  it("requires a rollout percentage for local branch rollout", async () => {
    const io = createTestIo();

    await expect(
      runCli(["branch", "rollout", "br_draft", "--state", "missing.json"], io)
    ).resolves.toBe(1);

    expect(io.errorOutput()).toContain("--percentage is required");
  });

  it("reverts local branch fixtures and routing falls back to default", async () => {
    const seedIo = createTestIo();
    const revertIo = createTestIo();
    const routeIo = createTestIo();
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-branch-revert-")), "seed.json");

    await expect(
      runCli(["demo", "seed", "--output", outputPath, "--manifest", manifestPath], seedIo)
    ).resolves.toBe(0);

    await expect(
      runCli(
        [
          "branch",
          "revert",
          "br_demo_seed",
          "--reason",
          "guardrail increased",
          "--state",
          outputPath,
          "--json"
        ],
        revertIo
      )
    ).resolves.toBe(0);

    const state = JSON.parse(await readFile(outputPath, "utf8")) as {
      branches: Array<{ status: string; rolloutPercentage: number; revertReason?: string }>;
      auditLogs: Array<{ event: string; resourceId: string }>;
    };

    expect(state.branches[0]).toMatchObject({
      status: "reverted",
      rolloutPercentage: 0,
      revertReason: "guardrail increased"
    });
    expect(state.auditLogs.at(-1)).toMatchObject({
      event: "branch_reverted",
      resourceId: "br_demo_seed"
    });

    await expect(
      runCli(
        [
          "route",
          "test",
          "pricing.hero",
          "--user",
          "user_123",
          "--segment",
          "lifecycle_stage=new_user",
          "--branches",
          outputPath,
          "--json",
          "--manifest",
          manifestPath
        ],
        routeIo
      )
    ).resolves.toBe(0);

    const resolved = JSON.parse(routeIo.output()) as { variant: string; reason: string };
    expect(resolved).toMatchObject({
      variant: "default",
      reason: "default_fallback"
    });
  });

  it("passes eval patch-boundary for authorized changed files", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "eval",
          "patch-boundary",
          "--surface",
          "pricing.hero",
          "--changed-file",
          "apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const result = JSON.parse(io.output()) as { passed: boolean; name: string };
    expect(result).toMatchObject({
      name: "patch_boundary",
      passed: true
    });
  });

  it("fails eval patch-boundary for unauthorized changed files", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "eval",
          "patch-boundary",
          "--surface",
          "pricing.hero",
          "--changed-file",
          "apps/demo-nextjs/src/app/billing/Checkout.tsx",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(1);

    const result = JSON.parse(io.output()) as { passed: boolean; details: string[] };
    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("Unauthorized file");
  });

  it("fails eval security for forbidden changed files", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "eval",
          "security",
          "--changed-file",
          ".env.local",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(1);

    const result = JSON.parse(io.output()) as { passed: boolean; details: string[] };
    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("secrets");
  });

  it("allows explicitly approved eval security risk categories", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "eval",
          "security",
          "--changed-file",
          "packages/db/migrations/0001_initial.sql",
          "--allow-risk",
          "database_schema",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const result = JSON.parse(io.output()) as { passed: boolean; details: string[] };
    expect(result.passed).toBe(true);
  });

  it("prints database migration status", async () => {
    const io = createTestIo();

    await expect(runCli(["db", "status", "--json"], io)).resolves.toBe(0);

    const result = JSON.parse(io.output()) as {
      migrations: Array<{ id: string; name: string; path: string }>;
    };
    expect(result.migrations).toHaveLength(1);
    expect(result.migrations[0]).toMatchObject({
      id: "0001_initial",
      name: "0001_initial.sql"
    });
  });

  it("prints a dry-run database migration plan", async () => {
    const io = createTestIo();

    await expect(runCli(["db", "migrate", "--dry-run", "--json"], io)).resolves.toBe(0);

    const result = JSON.parse(io.output()) as {
      dryRun: boolean;
      migrations: Array<{ id: string }>;
      applied: Array<{ id: string }>;
    };
    expect(result.dryRun).toBe(true);
    expect(result.migrations.map((migration) => migration.id)).toEqual(["0001_initial"]);
    expect(result.applied).toEqual([]);
  });

  it("requires a database URL for non-dry-run migrations", async () => {
    const io = createTestIo();
    const previousDatabaseUrl = process.env.DATABASE_URL;

    delete process.env.DATABASE_URL;

    try {
      await expect(runCli(["db", "migrate"], io)).resolves.toBe(1);

      expect(io.errorOutput()).toContain("--database-url or DATABASE_URL");
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("prints a passing eval report for authorized changed files", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "eval",
          "report",
          "--surface",
          "pricing.hero",
          "--changed-file",
          "apps/demo-nextjs/src/app/pricing/PricingHero.tsx",
          "--manifest",
          manifestPath
        ],
        io
      )
    ).resolves.toBe(0);

    const report = JSON.parse(io.output()) as {
      status: string;
      checks: { patch_boundary: boolean; security_policy: boolean };
    };
    expect(report.status).toBe("passed");
    expect(report.checks.patch_boundary).toBe(true);
    expect(report.checks.security_policy).toBe(true);
  });

  it("lists bundled safety fixtures", async () => {
    const io = createTestIo();

    await expect(runCli(["eval", "fixtures", "--json"], io)).resolves.toBe(0);

    const output = JSON.parse(io.output()) as {
      fixtures: Array<{ id: string; expected: { evalStatus: string } }>;
    };
    expect(output.fixtures.map((fixture) => fixture.id)).toContain("payment-logic-blocked");
    expect(output.fixtures.map((fixture) => fixture.id)).toContain(
      "prompt-injection-feedback-is-data"
    );
  });

  it("runs a blocked safety fixture as an expected pass", async () => {
    const io = createTestIo();

    await expect(
      runCli(
        [
          "eval",
          "fixture",
          "payment-logic-blocked",
          "--manifest",
          manifestPath,
          "--json"
        ],
        io
      )
    ).resolves.toBe(0);

    const output = JSON.parse(io.output()) as {
      passed: boolean;
      evalReport: { status: string; failures: string[] };
      policyDecision: { allowed: boolean };
    };
    expect(output.passed).toBe(true);
    expect(output.evalReport.status).toBe("failed");
    expect(output.evalReport.failures).toEqual(["security_policy"]);
    expect(output.policyDecision.allowed).toBe(false);
  });
});

function createTestIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout: {
      log: vi.fn((message?: unknown) => {
        stdout.push(String(message ?? ""));
      })
    },
    stderr: {
      error: vi.fn((message?: unknown) => {
        stderr.push(String(message ?? ""));
      })
    },
    output: () => stdout.join("\n"),
    errorOutput: () => stderr.join("\n")
  };
}
