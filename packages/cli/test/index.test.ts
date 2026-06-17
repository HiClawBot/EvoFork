import { mkdtemp, readFile } from "node:fs/promises";
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
