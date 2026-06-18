import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BranchRegistryError,
  InMemoryAuditLogRepository,
  InMemoryBranchRegistry,
  approveLocalBranch,
  createLocalBranch,
  emptyLocalDemoState,
  listLocalApps,
  promoteLocalBranch,
  readLocalDemoState,
  recordLocalBranchAuditLog,
  revertLocalBranch,
  rolloutLocalBranch,
  serviceId,
  upsertLocalApp,
  writeLocalDemoState
} from "../src/index.js";

describe(serviceId, () => {
  it("creates draft branches and writes audit logs", async () => {
    const auditLog = new InMemoryAuditLogRepository({
      idGenerator: createIdGenerator("audit"),
      clock: fixedClock
    });
    const registry = new InMemoryBranchRegistry({
      auditLog,
      idGenerator: createIdGenerator("br"),
      clock: fixedClock
    });

    const branch = await registry.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchName: "pricing.hero.new-user-clarity.v1",
      targetSegments: {
        lifecycle_stage: "new_user"
      },
      createdBy: "codex"
    });

    expect(branch).toMatchObject({
      id: "br_1",
      status: "draft",
      rolloutPercentage: 0,
      targetSegments: {
        lifecycle_stage: "new_user"
      }
    });

    const logs = await auditLog.list();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      event: "branch_created",
      resourceId: "br_1",
      actor: "codex"
    });
  });

  it("approves, rolls out, reverts, and sunsets branches", async () => {
    const registry = new InMemoryBranchRegistry({
      idGenerator: createIdGenerator("br"),
      clock: fixedClock
    });
    const created = await registry.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchName: "pricing.hero.new-user-clarity.v1"
    });

    const approved = await registry.approve(created.id, { actor: "maintainer" });
    expect(approved.status).toBe("canary");
    expect(approved.approvedBy).toBe("maintainer");

    const canary = await registry.rollout(created.id, {
      percentage: 10,
      actor: "maintainer"
    });
    expect(canary.status).toBe("canary");
    expect(canary.rolloutPercentage).toBe(10);

    const active = await registry.promote(created.id, { actor: "maintainer" });
    expect(active.status).toBe("active");
    expect(active.rolloutPercentage).toBe(100);

    const reverted = await registry.revert(created.id, {
      reason: "guardrail increased",
      actor: "maintainer"
    });
    expect(reverted.status).toBe("reverted");
    expect(reverted.rolloutPercentage).toBe(0);
    expect(reverted.revertReason).toBe("guardrail increased");

    const sunset = await registry.sunset(created.id, { actor: "maintainer" });
    expect(sunset.status).toBe("sunset");
  });

  it("rejects invalid transitions", async () => {
    const registry = new InMemoryBranchRegistry({
      idGenerator: createIdGenerator("br"),
      clock: fixedClock
    });
    const created = await registry.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchName: "pricing.hero.new-user-clarity.v1"
    });

    await expect(
      registry.rollout(created.id, { percentage: 10 })
    ).rejects.toBeInstanceOf(BranchRegistryError);
    await expect(registry.promote(created.id)).rejects.toBeInstanceOf(BranchRegistryError);
  });

  it("filters branches by app, surface, and status", async () => {
    const registry = new InMemoryBranchRegistry({
      idGenerator: createIdGenerator("br"),
      clock: fixedClock
    });
    const pricing = await registry.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchName: "pricing.hero.new-user-clarity.v1"
    });
    await registry.approve(pricing.id);
    await registry.create({
      appId: "demo-saas",
      surfaceId: "onboarding.signup",
      branchName: "onboarding.signup.shorter-copy.v1"
    });

    const branches = await registry.list({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      statuses: ["canary"]
    });

    expect(branches).toHaveLength(1);
    expect(branches[0].id).toBe(pricing.id);
  });

  it("creates and mutates local demo branch state", () => {
    const state = emptyLocalDemoState("demo-seed.json", {
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      signals: []
    });

    expect(listLocalApps(state)).toEqual([
      {
        id: "demo-saas",
        defaultBranch: "main",
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z"
      }
    ]);

    const created = createLocalBranch(
      state,
      {
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        branchName: "pricing.hero.local.v1",
        targetSegments: {
          lifecycle_stage: "new_user"
        },
        actor: "maintainer"
      },
      "2026-06-18T00:00:00.000Z"
    );

    expect(created.branch).toMatchObject({
      id: "br_local_001",
      status: "draft",
      rolloutPercentage: 0
    });
    expect(created.auditLog.event).toBe("branch_created");

    const approved = approveLocalBranch(
      state,
      created.branch.id,
      "maintainer",
      "2026-06-18T00:01:00.000Z"
    );
    expect(approved.branch.status).toBe("canary");

    const rolledOut = rolloutLocalBranch(
      state,
      created.branch.id,
      25,
      "maintainer",
      "2026-06-18T00:02:00.000Z"
    );
    expect(rolledOut.branch).toMatchObject({
      status: "canary",
      rolloutPercentage: 25
    });

    const promoted = promoteLocalBranch(
      state,
      created.branch.id,
      "maintainer",
      "2026-06-18T00:02:30.000Z"
    );
    expect(promoted.branch).toMatchObject({
      status: "active",
      rolloutPercentage: 100
    });

    const reverted = revertLocalBranch(
      state,
      created.branch.id,
      "guardrail increased",
      "maintainer",
      "2026-06-18T00:03:00.000Z"
    );
    expect(reverted.branch).toMatchObject({
      status: "reverted",
      rolloutPercentage: 0,
      revertReason: "guardrail increased"
    });
    expect(state.auditLogs.map((log) => log.event)).toEqual([
      "branch_created",
      "branch_approved",
      "branch_rollout_changed",
      "branch_promoted",
      "branch_reverted"
    ]);
  });

  it("tracks multiple apps in local workspace state", async () => {
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-multi-app-")), "state.json");
    const state = emptyLocalDemoState(outputPath);

    upsertLocalApp(
      state,
      {
        id: "demo-saas",
        name: "Demo SaaS",
        defaultBranch: "main",
        manifestPath: "evo.manifest.yaml"
      },
      "2026-06-18T00:00:00.000Z"
    );
    upsertLocalApp(
      state,
      {
        id: "docs-site",
        name: "Docs Site",
        defaultBranch: "main",
        manifestPath: "examples/docs/evo.manifest.yaml"
      },
      "2026-06-18T00:01:00.000Z"
    );
    createLocalBranch(
      state,
      {
        appId: "docs-site",
        surfaceId: "docs.quickstart",
        branchName: "docs.quickstart.shorter.v1",
        branchId: "br_docs"
      },
      "2026-06-18T00:02:00.000Z"
    );

    await writeLocalDemoState(state);

    const restored = await readLocalDemoState(outputPath);
    expect(listLocalApps(restored).map((app) => app.id)).toEqual(["demo-saas", "docs-site"]);
    expect(restored.branches[0]).toMatchObject({
      appId: "docs-site",
      surfaceId: "docs.quickstart"
    });
    expect(restored.auditLogs[0]).toMatchObject({
      appId: "docs-site",
      event: "branch_created"
    });
  });

  it("records explicit local branch audit events", () => {
    const state = emptyLocalDemoState("local-state.json");
    const created = createLocalBranch(
      state,
      {
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        branchName: "pricing.hero.local.v1",
        actor: "maintainer"
      },
      "2026-06-18T00:00:00.000Z"
    );

    const auditLog = recordLocalBranchAuditLog(
      state,
      created.branch.id,
      "maintainer",
      "policy_allowed",
      {
        action: "rollout",
        rolloutPercentage: 5
      },
      "2026-06-18T00:01:00.000Z"
    );

    expect(auditLog).toMatchObject({
      id: "audit_local_002",
      event: "policy_allowed",
      resourceId: created.branch.id,
      payload: {
        action: "rollout",
        rolloutPercentage: 5
      }
    });
    expect(state.auditLogs.map((log) => log.event)).toEqual([
      "branch_created",
      "policy_allowed"
    ]);
  });

  it("records explicit registry audit events", async () => {
    const registry = new InMemoryBranchRegistry({
      idGenerator: createIdGenerator("br"),
      clock: fixedClock
    });
    const branch = await registry.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchName: "pricing.hero.local.v1"
    });

    const auditLog = await registry.recordAudit(branch.id, {
      actor: "maintainer",
      event: "policy_allowed",
      payload: {
        action: "promote"
      }
    });

    expect(auditLog).toMatchObject({
      event: "policy_allowed",
      resourceId: branch.id,
      payload: {
        action: "promote"
      }
    });
  });

  it("reads and writes local demo branch state files", async () => {
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-local-state-")), "seed.json");
    const state = emptyLocalDemoState(outputPath, {
      appId: "demo-saas",
      signals: [{ id: "sig_1" }]
    });
    createLocalBranch(
      state,
      {
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        branchName: "pricing.hero.local.v1",
        branchId: "br_fixture"
      },
      "2026-06-18T00:00:00.000Z"
    );

    await writeLocalDemoState(state);

    const parsed = JSON.parse(await readFile(outputPath, "utf8")) as {
      apps: Array<{ id: string }>;
      signals: unknown[];
      branches: Array<{ id: string; createdBy: string }>;
      auditLogs: Array<{ event: string }>;
    };
    expect(parsed.apps).toEqual([
      {
        id: "demo-saas",
        defaultBranch: "main",
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "2026-06-18T00:00:00.000Z"
      }
    ]);
    expect(parsed.signals).toHaveLength(1);
    expect(parsed.branches[0]).toMatchObject({
      id: "br_fixture",
      createdBy: "local-maintainer"
    });
    expect(parsed.auditLogs[0].event).toBe("branch_created");

    const restored = await readLocalDemoState(outputPath);
    expect(restored.branches[0]).toMatchObject({
      id: "br_fixture",
      status: "draft"
    });
  });
});

function createIdGenerator(prefix: string): () => string {
  let counter = 0;

  return () => {
    counter += 1;
    return `${prefix}_${counter}`;
  };
}

function fixedClock(): Date {
  return new Date("2026-06-17T00:00:00.000Z");
}
