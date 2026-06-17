import { describe, expect, it } from "vitest";
import {
  inRollout,
  resolveVariant,
  segmentsMatch,
  serviceId,
  stableHash,
  type RouterBranch
} from "../src/index.js";

const branch: RouterBranch = {
  id: "br_123",
  appId: "demo-saas",
  surfaceId: "pricing.hero",
  branchName: "pricing.hero.new-user-clarity.v1",
  status: "canary",
  targetSegments: {
    lifecycle_stage: "new_user",
    company_size: ["1-10", "11-50"]
  },
  rolloutPercentage: 100,
  priority: 10
};

describe(serviceId, () => {
  it("uses a stable hash for rollout decisions", () => {
    expect(stableHash("user_123:br_123")).toBe(stableHash("user_123:br_123"));
    expect(inRollout("user_123", "br_123", 0)).toBe(false);
    expect(inRollout("user_123", "br_123", 100)).toBe(true);
    expect(inRollout("user_123", "br_123", 50)).toBe(
      inRollout("user_123", "br_123", 50)
    );
  });

  it("matches segment arrays and scalar values", () => {
    expect(
      segmentsMatch(branch.targetSegments, {
        lifecycle_stage: "new_user",
        company_size: "1-10"
      })
    ).toBe(true);

    expect(
      segmentsMatch(branch.targetSegments, {
        lifecycle_stage: "existing_user",
        company_size: "1-10"
      })
    ).toBe(false);
  });

  it("returns opt-out fallback without considering branches", () => {
    const result = resolveVariant(
      {
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        userId: "user_123",
        personalizationOptOut: true
      },
      [branch]
    );

    expect(result).toEqual({
      surfaceId: "pricing.hero",
      variant: "default",
      branchId: null,
      reason: "personalization_opt_out",
      sticky: false
    });
  });

  it("returns the highest-priority matching branch", () => {
    const lowerPriority: RouterBranch = {
      ...branch,
      id: "br_001",
      branchName: "pricing.hero.secondary.v1",
      priority: 1
    };
    const result = resolveVariant(
      {
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        userId: "user_123",
        segmentHints: {
          lifecycle_stage: "new_user",
          company_size: "1-10"
        }
      },
      [lowerPriority, branch]
    );

    expect(result).toMatchObject({
      variant: "pricing.hero.new-user-clarity.v1",
      branchId: "br_123",
      reason: "matched_segment_and_rollout",
      sticky: true
    });
  });

  it("ignores reverted branches and restricted segment targets", () => {
    const result = resolveVariant(
      {
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        userId: "user_123",
        segmentHints: {
          lifecycle_stage: "new_user",
          race: "blocked"
        }
      },
      [
        {
          ...branch,
          id: "br_reverted",
          status: "reverted"
        },
        {
          ...branch,
          id: "br_restricted",
          targetSegments: {
            race: "blocked"
          }
        }
      ]
    );

    expect(result).toEqual({
      surfaceId: "pricing.hero",
      variant: "default",
      branchId: null,
      reason: "default_fallback",
      sticky: false
    });
  });
});
