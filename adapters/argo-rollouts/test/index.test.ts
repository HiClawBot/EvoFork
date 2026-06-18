import { describe, expect, it } from "vitest";
import {
  adapterId,
  generateArgoRolloutDryRunPlan,
  getAdapterStatus,
  renderArgoRolloutManifestJson,
  toKubernetesName
} from "../src/index.js";

describe(adapterId, () => {
  it("reports dry-run planner status", () => {
    expect(getAdapterStatus()).toBe(`${adapterId}: dry-run planner`);
  });

  it("generates a safe Argo Rollouts dry-run manifest", () => {
    const plan = generateArgoRolloutDryRunPlan({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchId: "br_demo_seed",
      branchName: "pricing.hero.new-user-clarity.v1",
      namespace: "demo",
      workloadRefName: "demo-nextjs",
      stableServiceName: "demo-nextjs-stable",
      canaryServiceName: "demo-nextjs-canary",
      canaryWeight: 25,
      replicas: 2,
      maxAutoPercentage: 5,
      requireHumanApproval: true,
      humanApproved: true
    });

    expect(plan).toMatchObject({
      mode: "dry-run",
      decision: "ready",
      reasons: [],
      safety: {
        dryRun: true,
        clusterWrites: false,
        generatedOnly: true,
        requiresManualApply: true
      },
      rollout: {
        namespace: "demo",
        rolloutName: "evofork-pricing-hero-br-demo-seed",
        canaryWeight: 25
      },
      audit: {
        event: "argo_rollout_dry_run_generated",
        payload: {
          surfaceId: "pricing.hero",
          branchId: "br_demo_seed",
          clusterWrites: false
        }
      }
    });
    expect(plan.manifest).toMatchObject({
      apiVersion: "argoproj.io/v1alpha1",
      kind: "Rollout",
      metadata: {
        name: "evofork-pricing-hero-br-demo-seed",
        labels: {
          "app.kubernetes.io/managed-by": "evofork",
          "evofork.io/surface-id": "pricing.hero",
          "evofork.io/branch-id": "br_demo_seed"
        },
        annotations: {
          "evofork.io/dry-run": "true",
          "evofork.io/generated-by": adapterId
        }
      },
      spec: {
        replicas: 2,
        workloadRef: {
          apiVersion: "apps/v1",
          kind: "Deployment",
          name: "demo-nextjs"
        },
        strategy: {
          canary: {
            stableService: "demo-nextjs-stable",
            canaryService: "demo-nextjs-canary",
            steps: [
              {
                setWeight: 25
              },
              {
                pause: {}
              }
            ]
          }
        }
      }
    });
    expect(JSON.parse(plan.manifestJson)).toEqual(plan.manifest);
  });

  it("blocks unapproved plans that exceed manifest rollout policy", () => {
    const plan = generateArgoRolloutDryRunPlan({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchId: "br_demo_seed",
      workloadRefName: "demo-nextjs",
      stableServiceName: "demo-nextjs-stable",
      canaryServiceName: "demo-nextjs-canary",
      canaryWeight: 25,
      maxAutoPercentage: 5,
      requireHumanApproval: true
    });

    expect(plan.decision).toBe("blocked");
    expect(plan.reasons.join("\n")).toContain("Human approval is required");
    expect(plan.reasons.join("\n")).toContain("max_auto_percentage 5%");
    expect(plan.safety.clusterWrites).toBe(false);
  });

  it("renders deterministic JSON manifests and Kubernetes-safe names", () => {
    const plan = generateArgoRolloutDryRunPlan({
      appId: "Demo SaaS",
      surfaceId: "Pricing Hero",
      branchId: "BR Demo Seed",
      workloadRefName: "demo-nextjs",
      stableServiceName: "demo-nextjs-stable",
      canaryServiceName: "demo-nextjs-canary",
      canaryWeight: 5
    });

    expect(toKubernetesName("Pricing Hero/BR Demo Seed")).toBe("pricing-hero-br-demo-seed");
    expect(plan.rollout.rolloutName).toBe("evofork-pricing-hero-br-demo-seed");
    expect(renderArgoRolloutManifestJson(plan.manifest)).toBe(plan.manifestJson);
  });
});
