export const adapterId = "@evofork/adapter-argo-rollouts";

export type ArgoRolloutDryRunInput = {
  appId: string;
  surfaceId: string;
  branchId: string;
  branchName?: string;
  namespace?: string;
  rolloutName?: string;
  workloadRefName: string;
  stableServiceName: string;
  canaryServiceName: string;
  canaryWeight: number;
  replicas?: number;
  maxAutoPercentage?: number;
  requireHumanApproval?: boolean;
  humanApproved?: boolean;
  pauseDuration?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
};

export type ArgoRolloutManifest = {
  apiVersion: "argoproj.io/v1alpha1";
  kind: "Rollout";
  metadata: {
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
  spec: {
    replicas?: number;
    workloadRef: {
      apiVersion: "apps/v1";
      kind: "Deployment";
      name: string;
    };
    strategy: {
      canary: {
        stableService: string;
        canaryService: string;
        steps: Array<
          | {
              setWeight: number;
            }
          | {
              pause: {
                duration?: string;
              };
            }
        >;
      };
    };
  };
};

export type ArgoRolloutDryRunPlan = {
  adapterId: typeof adapterId;
  mode: "dry-run";
  decision: "ready" | "blocked";
  reasons: string[];
  warnings: string[];
  safety: {
    dryRun: true;
    clusterWrites: false;
    generatedOnly: true;
    requiresManualApply: true;
  };
  rollout: {
    appId: string;
    surfaceId: string;
    branchId: string;
    branchName?: string;
    canaryWeight: number;
    namespace: string;
    rolloutName: string;
  };
  manifest: ArgoRolloutManifest;
  manifestJson: string;
  reviewCommands: string[];
  audit: {
    event: "argo_rollout_dry_run_generated";
    payload: {
      surfaceId: string;
      branchId: string;
      canaryWeight: number;
      decision: "ready" | "blocked";
      clusterWrites: false;
    };
  };
};

export function getAdapterStatus(): string {
  return `${adapterId}: dry-run planner`;
}

export function generateArgoRolloutDryRunPlan(
  input: ArgoRolloutDryRunInput
): ArgoRolloutDryRunPlan {
  validateDryRunInput(input);

  const namespace = input.namespace ?? "default";
  const rolloutName = input.rolloutName ?? toKubernetesName(
    `evofork-${input.surfaceId}-${input.branchId}`,
    "evofork-rollout"
  );
  assertKubernetesName(namespace, "namespace");
  assertKubernetesName(rolloutName, "rolloutName");
  assertKubernetesName(input.workloadRefName, "workloadRefName");
  assertKubernetesName(input.stableServiceName, "stableServiceName");
  assertKubernetesName(input.canaryServiceName, "canaryServiceName");

  const reasons = getPolicyReasons(input);
  const decision = reasons.length === 0 ? "ready" : "blocked";
  const manifest = buildManifest(input, namespace, rolloutName);

  return {
    adapterId,
    mode: "dry-run",
    decision,
    reasons,
    warnings: [
      "Generated manifest is advisory and must be reviewed before use.",
      "This adapter does not connect to Kubernetes or write cluster state."
    ],
    safety: {
      dryRun: true,
      clusterWrites: false,
      generatedOnly: true,
      requiresManualApply: true
    },
    rollout: {
      appId: input.appId,
      surfaceId: input.surfaceId,
      branchId: input.branchId,
      ...(input.branchName ? { branchName: input.branchName } : {}),
      canaryWeight: input.canaryWeight,
      namespace,
      rolloutName
    },
    manifest,
    manifestJson: renderArgoRolloutManifestJson(manifest),
    reviewCommands: [
      "kubectl argo rollouts lint <manifest.json>",
      "kubectl apply --dry-run=client -f <manifest.json>"
    ],
    audit: {
      event: "argo_rollout_dry_run_generated",
      payload: {
        surfaceId: input.surfaceId,
        branchId: input.branchId,
        canaryWeight: input.canaryWeight,
        decision,
        clusterWrites: false
      }
    }
  };
}

export function renderArgoRolloutManifestJson(manifest: ArgoRolloutManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function toKubernetesName(value: string, fallback = "evofork-resource"): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63)
    .replace(/-+$/g, "");

  return normalized || fallback;
}

function validateDryRunInput(input: ArgoRolloutDryRunInput): void {
  for (const [name, value] of Object.entries({
    appId: input.appId,
    surfaceId: input.surfaceId,
    branchId: input.branchId,
    workloadRefName: input.workloadRefName,
    stableServiceName: input.stableServiceName,
    canaryServiceName: input.canaryServiceName
  })) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${name} must be a non-empty string`);
    }
  }

  assertPercentage(input.canaryWeight, "canaryWeight");

  if (input.maxAutoPercentage !== undefined) {
    assertPercentage(input.maxAutoPercentage, "maxAutoPercentage");
  }

  if (
    input.replicas !== undefined &&
    (!Number.isInteger(input.replicas) || input.replicas <= 0)
  ) {
    throw new Error("replicas must be a positive integer");
  }
}

function assertPercentage(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be an integer from 0 to 100`);
  }
}

function assertKubernetesName(value: string, name: string): void {
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value) || value.length > 63) {
    throw new Error(`${name} must be a Kubernetes DNS label`);
  }
}

function getPolicyReasons(input: ArgoRolloutDryRunInput): string[] {
  const reasons: string[] = [];

  if (input.requireHumanApproval && !input.humanApproved) {
    reasons.push("Human approval is required before generating an executable rollout plan.");
  }

  if (
    input.maxAutoPercentage !== undefined &&
    input.canaryWeight > input.maxAutoPercentage &&
    !input.humanApproved
  ) {
    reasons.push(
      `Canary weight ${input.canaryWeight}% exceeds manifest max_auto_percentage ${input.maxAutoPercentage}%.`
    );
  }

  return reasons;
}

function buildManifest(
  input: ArgoRolloutDryRunInput,
  namespace: string,
  rolloutName: string
): ArgoRolloutManifest {
  const pause =
    input.pauseDuration === undefined
      ? {
          pause: {}
        }
      : {
          pause: {
            duration: input.pauseDuration
          }
        };
  const labels = {
    "app.kubernetes.io/name": labelValue(input.appId),
    "app.kubernetes.io/managed-by": "evofork",
    "evofork.io/surface-id": labelValue(input.surfaceId),
    "evofork.io/branch-id": labelValue(input.branchId),
    ...input.labels
  };

  return {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Rollout",
    metadata: {
      name: rolloutName,
      namespace,
      labels,
      annotations: {
        "evofork.io/dry-run": "true",
        "evofork.io/generated-by": adapterId,
        ...(input.branchName ? { "evofork.io/branch-name": input.branchName } : {}),
        ...input.annotations
      }
    },
    spec: {
      ...(input.replicas !== undefined ? { replicas: input.replicas } : {}),
      workloadRef: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: input.workloadRefName
      },
      strategy: {
        canary: {
          stableService: input.stableServiceName,
          canaryService: input.canaryServiceName,
          steps: [
            {
              setWeight: input.canaryWeight
            },
            pause
          ]
        }
      }
    }
  };
}

function labelValue(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.-]+/g, "-").slice(0, 63);
  const trimmed = normalized.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");

  return trimmed || "unknown";
}
