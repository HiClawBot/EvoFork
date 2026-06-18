import { describe, expect, it } from "vitest";
import {
  InMemoryMetricEventRepository,
  InMemorySignalRepository,
  serviceId
} from "../src/index.js";

describe(serviceId, () => {
  it("stores and lists signals by surface", async () => {
    const repository = new InMemorySignalRepository();

    const signal = await repository.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      source: "user_feedback",
      signalType: "confusion",
      text: "Basic vs Pro is unclear.",
      piiRemoved: true
    });

    await repository.create({
      appId: "demo-saas",
      surfaceId: "docs.quickstart",
      source: "user_feedback",
      signalType: "missing_example",
      piiRemoved: true
    });

    await expect(repository.listBySurface({ surfaceId: "pricing.hero" })).resolves.toEqual([
      signal
    ]);
  });

  it("marks pii-removed signals as eligible by default", async () => {
    const repository = new InMemorySignalRepository();

    const signal = await repository.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      source: "support_summary",
      signalType: "confusion",
      piiRemoved: true
    });

    expect(signal.llmEligible).toBe(true);
  });

  it("keeps non-pii-removed signals out of LLM eligibility by default", async () => {
    const repository = new InMemorySignalRepository();

    const signal = await repository.create({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      source: "support_summary",
      signalType: "confusion",
      piiRemoved: false
    });

    expect(signal.llmEligible).toBe(false);
  });

  it("stores and filters local metric events", async () => {
    const repository = new InMemoryMetricEventRepository();

    const baseline = await repository.create({
      appId: "demo-saas",
      event: "metric_observed",
      surfaceId: "pricing.hero",
      branchId: null,
      sessionId: "session_baseline",
      properties: {
        metric: "pricing_to_signup_conversion",
        value: 1,
        cohort: "baseline"
      }
    });

    await repository.create({
      appId: "demo-saas",
      event: "metric_observed",
      surfaceId: "pricing.hero",
      branchId: "br_demo_seed",
      sessionId: "session_canary",
      properties: {
        metric: "pricing_to_signup_conversion",
        value: 1,
        cohort: "canary"
      }
    });

    await repository.create({
      appId: "demo-saas",
      event: "metric_observed",
      surfaceId: "docs.quickstart",
      properties: {
        metric: "docs_completion",
        value: 1
      }
    });

    await expect(
      repository.list({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        branchId: null,
        event: "metric_observed"
      })
    ).resolves.toEqual([baseline]);
  });

  it("clones metric event properties on read", async () => {
    const repository = new InMemoryMetricEventRepository();

    await repository.create({
      appId: "demo-saas",
      event: "metric_observed",
      surfaceId: "pricing.hero",
      properties: {
        metric: "pricing_to_signup_conversion",
        value: 1
      }
    });

    const [first] = await repository.list();
    if (!first) {
      throw new Error("Expected metric event");
    }

    first.properties.value = 0;

    const [second] = await repository.list();
    expect(second?.properties.value).toBe(1);
  });
});
