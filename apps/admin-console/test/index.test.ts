import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appId, type AdminSnapshot } from "../src/index.js";
import { createDemoBranch, revertDemoBranch } from "../src/lib/demo-flow.js";
import { readDemoSeed } from "../src/lib/demo-state.js";

describe(appId, () => {
  afterEach(() => {
    delete process.env.EVOFORK_DEMO_SEED_PATH;
    vi.unstubAllGlobals();
  });

  it("models the admin dashboard snapshot", () => {
    const snapshot: AdminSnapshot = {
      apiAvailable: true,
      seedLoaded: false,
      signals: [
        {
          id: "sig_1",
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          signalType: "confusion",
          text: "Basic vs Pro is unclear."
        }
      ],
      branches: [
        {
          id: "br_1",
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          branchName: "pricing.hero.new-user-clarity.v1",
          status: "active",
          rolloutPercentage: 100
        }
      ],
      auditLogs: [
        {
          id: "audit_1",
          appId: "demo-saas",
          actor: "maintainer",
          event: "branch_rollout_changed",
          resourceId: "br_1"
        }
      ]
    };

    expect(snapshot.signals).toHaveLength(1);
    expect(snapshot.branches[0].status).toBe("active");
    expect(snapshot.auditLogs[0].event).toBe("branch_rollout_changed");
  });

  it("reads local demo seed state", async () => {
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-admin-seed-")), "seed.json");
    await writeFile(
      outputPath,
      JSON.stringify({
        signals: [
          {
            id: "demo_signal_001",
            appId: "demo-saas",
            surfaceId: "pricing.hero",
            signalType: "pricing_confusion",
            text: "Basic and Pro are unclear."
          }
        ],
        branches: [
          {
            id: "br_demo_seed",
            appId: "demo-saas",
            surfaceId: "pricing.hero",
            branchName: "pricing.hero.new-user-clarity.v1",
            status: "active",
            targetSegments: {
              lifecycle_stage: "new_user"
            },
            rolloutPercentage: 100
          }
        ],
        auditLogs: [
          {
            id: "audit_demo_seed_rollout",
            appId: "demo-saas",
            actor: "demo_seed",
            event: "branch_rollout_changed",
            resourceType: "branch",
            resourceId: "br_demo_seed",
            payload: {
              rolloutPercentage: 100
            },
            createdAt: "2026-06-17T00:00:00.000Z"
          }
        ]
      }),
      "utf8"
    );

    const seed = await readDemoSeed(outputPath);

    expect(seed.signals).toHaveLength(1);
    expect(seed.signals[0].signalType).toBe("pricing_confusion");
    expect(seed.branches).toHaveLength(1);
    expect(seed.branches[0].status).toBe("active");
    expect(seed.auditLogs).toHaveLength(1);
    expect(seed.auditLogs[0]).toMatchObject({
      event: "branch_rollout_changed",
      resourceId: "br_demo_seed"
    });
  });

  it("creates and reverts local demo branches when the API is unavailable", async () => {
    const outputPath = join(await mkdtemp(join(tmpdir(), "evofork-admin-local-")), "seed.json");
    process.env.EVOFORK_DEMO_SEED_PATH = outputPath;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("api unavailable")));

    const created = await createDemoBranch();

    expect(created).toMatchObject({
      ok: true,
      action: "create_demo_branch"
    });

    const createdState = JSON.parse(await readFile(outputPath, "utf8")) as {
      branches: Array<{ id: string; status: string; rolloutPercentage: number }>;
      auditLogs: Array<{ event: string }>;
    };
    expect(createdState.branches[0]).toMatchObject({
      id: "br_local_001",
      status: "active",
      rolloutPercentage: 100
    });
    expect(createdState.auditLogs.map((log) => log.event)).toEqual([
      "branch_created",
      "branch_approved",
      "branch_rollout_changed"
    ]);

    const reverted = await revertDemoBranch("br_local_001");

    expect(reverted).toMatchObject({
      ok: true,
      action: "revert_branch"
    });

    const revertedState = JSON.parse(await readFile(outputPath, "utf8")) as {
      branches: Array<{ id: string; status: string; rolloutPercentage: number }>;
      auditLogs: Array<{ event: string }>;
    };
    expect(revertedState.branches[0]).toMatchObject({
      id: "br_local_001",
      status: "reverted",
      rolloutPercentage: 0
    });
    expect(revertedState.auditLogs.at(-1)?.event).toBe("branch_reverted");
  });
});
