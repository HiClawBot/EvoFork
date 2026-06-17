import type { BranchStatus, SegmentValue, TargetSegments } from "@evofork/branch-registry";

export const serviceId = "@evofork/router";

export type RouterBranch = {
  id: string;
  appId: string;
  surfaceId: string;
  branchName: string;
  status: BranchStatus;
  targetSegments: TargetSegments;
  rolloutPercentage: number;
  priority?: number;
  createdAt?: string;
};

export type ResolveVariantInput = {
  appId: string;
  surfaceId: string;
  userId?: string;
  sessionId?: string;
  segmentHints?: Record<string, SegmentValue | undefined>;
  personalizationOptOut?: boolean;
};

export type ResolveVariantResult = {
  surfaceId: string;
  variant: string;
  branchId: string | null;
  reason:
    | "matched_segment_and_rollout"
    | "personalization_opt_out"
    | "default_fallback";
  sticky: boolean;
};

export const restrictedSegmentFields = [
  "race",
  "religion",
  "political_view",
  "health_status",
  "precise_location"
] as const;

export function resolveVariant(
  input: ResolveVariantInput,
  branches: RouterBranch[]
): ResolveVariantResult {
  if (input.personalizationOptOut) {
    return defaultVariant(input.surfaceId, "personalization_opt_out");
  }

  const segmentHints = stripRestrictedSegmentFields(input.segmentHints ?? {});
  const userKey = input.userId ?? input.sessionId ?? "anonymous";
  const candidates = branches
    .filter((branch) => branch.appId === input.appId)
    .filter((branch) => branch.surfaceId === input.surfaceId)
    .filter((branch) => branch.status === "canary" || branch.status === "active")
    .filter((branch) => !hasRestrictedTargetSegments(branch.targetSegments))
    .filter((branch) => segmentsMatch(branch.targetSegments, segmentHints))
    .filter((branch) => inRollout(userKey, branch.id, branch.rolloutPercentage))
    .sort(compareBranchPriority);

  const selected = candidates[0];

  if (!selected) {
    return defaultVariant(input.surfaceId, "default_fallback");
  }

  return {
    surfaceId: input.surfaceId,
    variant: selected.branchName,
    branchId: selected.id,
    reason: "matched_segment_and_rollout",
    sticky: true
  };
}

export function stableHash(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function inRollout(userId: string, branchId: string, percentage: number): boolean {
  if (percentage <= 0) {
    return false;
  }

  if (percentage >= 100) {
    return true;
  }

  return stableHash(`${userId}:${branchId}`) % 100 < percentage;
}

export function segmentsMatch(
  targetSegments: TargetSegments,
  segmentHints: Record<string, SegmentValue | undefined>
): boolean {
  return Object.entries(targetSegments).every(([key, expected]) => {
    const actual = segmentHints[key];

    if (actual === undefined) {
      return false;
    }

    return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
  });
}

function stripRestrictedSegmentFields(
  segmentHints: Record<string, SegmentValue | undefined>
): Record<string, SegmentValue | undefined> {
  return Object.fromEntries(
    Object.entries(segmentHints).filter(([key]) => !isRestrictedSegmentField(key))
  );
}

function hasRestrictedTargetSegments(targetSegments: TargetSegments): boolean {
  return Object.keys(targetSegments).some(isRestrictedSegmentField);
}

function isRestrictedSegmentField(field: string): boolean {
  return restrictedSegmentFields.includes(
    field as (typeof restrictedSegmentFields)[number]
  );
}

function compareBranchPriority(left: RouterBranch, right: RouterBranch): number {
  const priorityDiff = (right.priority ?? 0) - (left.priority ?? 0);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return left.id.localeCompare(right.id);
}

function defaultVariant(
  surfaceId: string,
  reason: "personalization_opt_out" | "default_fallback"
): ResolveVariantResult {
  return {
    surfaceId,
    variant: "default",
    branchId: null,
    reason,
    sticky: false
  };
}
