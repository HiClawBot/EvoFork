import { describe, expect, it } from "vitest";
import {
  analyzeCanary,
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
});
