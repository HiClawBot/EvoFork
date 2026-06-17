import { describe, expect, it } from "vitest";
import { appId, type AdminSnapshot } from "../src/index.js";

describe(appId, () => {
  it("models the admin dashboard snapshot", () => {
    const snapshot: AdminSnapshot = {
      apiAvailable: true,
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
});
