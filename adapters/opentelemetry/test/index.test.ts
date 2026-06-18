import { describe, expect, it } from "vitest";
import {
  adapterId,
  analyzeOtelCanary,
  buildCanaryInputFromOtelMetrics,
  getAdapterStatus,
  otelMetricPointsToCanaryEvents
} from "../src/index.js";

describe(adapterId, () => {
  it("reports local observer bridge status", () => {
    expect(getAdapterStatus()).toBe(`${adapterId}: local observer bridge`);
  });

  it("converts OTel-style metric points into local canary metric events", () => {
    const events = otelMetricPointsToCanaryEvents({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchId: "br_demo_seed",
      points: [
        metricPoint("pricing_to_signup_conversion", 0, "baseline", "baseline_1"),
        metricPoint("pricing_to_signup_conversion", 1, "canary", "canary_1")
      ]
    });

    expect(events).toEqual([
      {
        appId: "demo-saas",
        event: "metric_observed",
        surfaceId: "pricing.hero",
        branchId: null,
        sessionId: "baseline_1",
        properties: {
          metric: "pricing_to_signup_conversion",
          value: 0,
          cohort: "baseline",
          source: "opentelemetry_local_adapter",
          direction: "increase"
        }
      },
      {
        appId: "demo-saas",
        event: "metric_observed",
        surfaceId: "pricing.hero",
        branchId: "br_demo_seed",
        sessionId: "canary_1",
        properties: {
          metric: "pricing_to_signup_conversion",
          value: 1,
          cohort: "canary",
          source: "opentelemetry_local_adapter",
          direction: "increase"
        }
      }
    ]);
  });

  it("builds and analyzes canary input from OTel-style metric points", () => {
    const bridgeInput = {
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      branchId: "br_demo_seed",
      branchName: "pricing.hero.new-user-clarity.v1",
      rolloutPercentage: 25,
      minSampleSize: 2,
      points: [
        metricPoint("pricing_to_signup_conversion", 0, "baseline", "baseline_1"),
        metricPoint("pricing_to_signup_conversion", 1, "baseline", "baseline_2"),
        metricPoint("pricing_to_signup_conversion", 1, "canary", "canary_1"),
        metricPoint("pricing_to_signup_conversion", 1, "canary", "canary_2"),
        metricPoint("page_error_rate", 1, "baseline", "baseline_1", "decrease"),
        metricPoint("page_error_rate", 0, "baseline", "baseline_2", "decrease"),
        metricPoint("page_error_rate", 0, "canary", "canary_1", "decrease"),
        metricPoint("page_error_rate", 0, "canary", "canary_2", "decrease")
      ]
    };
    const input = buildCanaryInputFromOtelMetrics(bridgeInput);

    expect(input).toMatchObject({
      sampleSize: 2,
      metrics: [
        {
          name: "pricing_to_signup_conversion",
          baseline: 0.5,
          canary: 1,
          direction: "increase"
        },
        {
          name: "page_error_rate",
          baseline: 0.5,
          canary: 0,
          direction: "decrease"
        }
      ]
    });

    expect(analyzeOtelCanary(bridgeInput)).toMatchObject({
      recommendation: "promote"
    });
  });
});

function metricPoint(
  name: string,
  value: number,
  cohort: "baseline" | "canary",
  sessionId: string,
  direction: "increase" | "decrease" = "increase"
) {
  return {
    name,
    value,
    attributes: {
      "evofork.cohort": cohort,
      "evofork.session_id": sessionId,
      "evofork.direction": direction
    }
  };
}
