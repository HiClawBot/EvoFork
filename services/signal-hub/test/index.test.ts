import { describe, expect, it } from "vitest";
import { InMemorySignalRepository, serviceId } from "../src/index.js";

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
});
