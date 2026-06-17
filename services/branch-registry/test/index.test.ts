import { describe, expect, it } from "vitest";
import {
  BranchRegistryError,
  InMemoryAuditLogRepository,
  InMemoryBranchRegistry,
  serviceId
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

    const active = await registry.rollout(created.id, {
      percentage: 100,
      actor: "maintainer"
    });
    expect(active.status).toBe("active");

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
