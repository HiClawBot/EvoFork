import { describe, expect, it } from "vitest";
import {
  analyzeCanary,
  buildCanaryInputFromMetricEvents,
  getCanaryFixture,
  listCanaryFixtures,
  serviceId
} from "../src/index.js";

describe(serviceId, () => {
  it("recommends promotion for healthy canary metrics", () => {
    const report = analyzeCanary(getCanaryFixture("healthy"));

    expect(report.status).toBe("passed");
    expect(report.recommendation).toBe("promote");
    expect(report.reasons).toEqual(["Canary metrics are within thresholds."]);
    expect(report.audit.payload).toMatchObject({
      status: "passed",
      recommendation: "promote"
    });
  });

  it("recommends rollback for guardrail regression", () => {
    const report = analyzeCanary(getCanaryFixture("regression"));

    expect(report.status).toBe("failed");
    expect(report.recommendation).toBe("rollback");
    expect(report.reasons.join("\n")).toContain("support_ticket_rate");
  });

  it("holds rollout when sample size is insufficient", () => {
    const report = analyzeCanary(getCanaryFixture("insufficient"));

    expect(report.status).toBe("warning");
    expect(report.recommendation).toBe("hold");
    expect(report.reasons.join("\n")).toContain("below minimum");
  });

  it("lists cloned fixtures", () => {
    const fixtures = listCanaryFixtures();
    fixtures[0].input.metrics[0].canary = 999;

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "healthy",
      "regression",
      "insufficient"
    ]);
    expect(getCanaryFixture("healthy").metrics[0].canary).toBe(0.138);
  });

  it("builds canary input from local metric events", () => {
    const input = buildCanaryInputFromMetricEvents({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchId: "br_demo_seed",
      branchName: "pricing.hero.new-user-clarity.v1",
      rolloutPercentage: 25,
      minSampleSize: 2,
      observedAt: "2026-06-17T00:00:00.000Z",
      events: [
        metricEvent("baseline_1", null, {
          value: 0,
          cohort: "baseline"
        }),
        metricEvent("baseline_2", null, {
          value: 1,
          cohort: "baseline"
        }),
        metricEvent("canary_1", "br_demo_seed", {
          value: 1,
          cohort: "canary"
        }),
        metricEvent("canary_2", "br_demo_seed", {
          value: 1,
          cohort: "canary"
        })
      ]
    });

    expect(input).toMatchObject({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchId: "br_demo_seed",
      rolloutPercentage: 25,
      sampleSize: 2,
      metrics: [
        {
          name: "pricing_to_signup_conversion",
          baseline: 0.5,
          canary: 1,
          direction: "increase"
        }
      ]
    });

    expect(analyzeCanary(input).recommendation).toBe("promote");
  });

  it("rejects metric event sets without baseline and canary pairs", () => {
    expect(() =>
      buildCanaryInputFromMetricEvents({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        branchId: "br_demo_seed",
        rolloutPercentage: 25,
        events: [
          metricEvent("canary_1", "br_demo_seed", {
            value: 1,
            cohort: "canary"
          })
        ]
      })
    ).toThrow("No complete canary metrics");
  });
});

function metricEvent(
  sessionId: string,
  branchId: string | null,
  properties: Record<string, unknown>
) {
  return {
    appId: "demo-saas",
    event: "metric_observed",
    surfaceId: "pricing.hero",
    branchId,
    sessionId,
    properties: {
      metric: "pricing_to_signup_conversion",
      direction: "increase",
      ...properties
    }
  };
}
