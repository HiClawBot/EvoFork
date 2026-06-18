import { findSurface, type EvoManifest, type EvoSurface } from "@evofork/manifest-parser";

export const serviceId = "@evofork/policy-engine";

export type PolicyAction = "patch" | "rollout" | "promote" | "approve" | "revert" | "sunset";

export type PolicyInput = {
  manifest: EvoManifest;
  surfaceId: string;
  action: PolicyAction;
  changeCategories?: string[];
  rolloutPercentage?: number;
  actor?: string;
  humanApproved?: boolean;
};

export type PolicyDecision = {
  allowed: boolean;
  action: PolicyAction;
  surfaceId: string;
  actor: string;
  reasons: string[];
  requiredApprovals: string[];
  audit: {
    event: "policy_allowed" | "policy_blocked";
    resourceType: "surface";
    resourceId: string;
    payload: Record<string, unknown>;
  };
};

const globallyBlockedChanges = new Set([
  "payment_logic",
  "authentication",
  "authorization",
  "database_schema",
  "legal_policy",
  "privacy_policy",
  "pricing_amount"
]);

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const actor = input.actor ?? "system";
  const reasons: string[] = [];
  const requiredApprovals: string[] = [];
  const surface = findSurface(input.manifest, input.surfaceId);

  if (!surface) {
    reasons.push(`Unknown surface: ${input.surfaceId}`);
    return buildDecision(input, actor, reasons, requiredApprovals);
  }

  evaluateChangeCategories(surface, input.changeCategories ?? [], reasons);
  evaluateRollout(surface, input, reasons, requiredApprovals);

  return buildDecision(input, actor, reasons, requiredApprovals);
}

export function getGloballyBlockedChanges(): string[] {
  return [...globallyBlockedChanges].sort();
}

function evaluateChangeCategories(
  surface: EvoSurface,
  changeCategories: string[],
  reasons: string[]
): void {
  for (const category of unique(changeCategories)) {
    if (globallyBlockedChanges.has(category) || surface.forbidden_changes.includes(category)) {
      reasons.push(`Change category is blocked: ${category}`);
      continue;
    }

    if (!surface.allowed_changes.includes(category)) {
      reasons.push(`Change category is not allowed for ${surface.id}: ${category}`);
    }
  }
}

function evaluateRollout(
  surface: EvoSurface,
  input: PolicyInput,
  reasons: string[],
  requiredApprovals: string[]
): void {
  if (input.rolloutPercentage === undefined) {
    return;
  }

  if (!Number.isInteger(input.rolloutPercentage) || input.rolloutPercentage < 0 || input.rolloutPercentage > 100) {
    reasons.push("Rollout percentage must be an integer from 0 to 100");
    return;
  }

  const rolloutPolicy = surface.rollout;

  if (!rolloutPolicy) {
    return;
  }

  if (rolloutPolicy.require_human_approval && !input.humanApproved && input.rolloutPercentage > 0) {
    reasons.push(`Human approval is required before rollout for ${surface.id}`);
    requiredApprovals.push("human_approval");
  }

  if (input.rolloutPercentage > rolloutPolicy.max_auto_percentage && !input.humanApproved) {
    reasons.push(
      `Rollout ${input.rolloutPercentage}% exceeds max_auto_percentage ${rolloutPolicy.max_auto_percentage}% for ${surface.id}`
    );
    requiredApprovals.push("rollout_approval");
  }
}

function buildDecision(
  input: PolicyInput,
  actor: string,
  reasons: string[],
  requiredApprovals: string[]
): PolicyDecision {
  const allowed = reasons.length === 0;

  return {
    allowed,
    action: input.action,
    surfaceId: input.surfaceId,
    actor,
    reasons: allowed ? ["Policy checks passed."] : unique(reasons),
    requiredApprovals: unique(requiredApprovals),
    audit: {
      event: allowed ? "policy_allowed" : "policy_blocked",
      resourceType: "surface",
      resourceId: input.surfaceId,
      payload: {
        action: input.action,
        changeCategories: input.changeCategories ?? [],
        rolloutPercentage: input.rolloutPercentage,
        humanApproved: input.humanApproved ?? false,
        reasons: allowed ? [] : unique(reasons)
      }
    }
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
