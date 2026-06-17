import { describe, expect, it } from "vitest";
import { MockLlmAdapter, adapterId } from "../src/index.js";

describe(adapterId, () => {
  it("generates deterministic pricing clarity RFCs", async () => {
    const adapter = new MockLlmAdapter();

    await expect(
      adapter.generateRfc({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        signals: [
          {
            surfaceId: "pricing.hero",
            text: "I do not understand Basic vs Pro.",
            signalType: "confusion"
          },
          {
            surfaceId: "pricing.hero",
            summary: "New users ask about plan differences.",
            evidenceCount: 47
          }
        ]
      })
    ).resolves.toMatchObject({
      rfcId: "rfc_pricing_clarity_001",
      surfaceId: "pricing.hero",
      targetMetric: "pricing_to_signup_conversion",
      guardrailMetrics: ["page_error_rate", "support_ticket_rate", "p95_latency"],
      risk: "low",
      evidenceCount: 48
    });
  });

  it("generates generic RFCs for other surfaces", async () => {
    const adapter = new MockLlmAdapter();
    const rfc = await adapter.generateRfc({
      appId: "demo-saas",
      surfaceId: "docs.quickstart",
      signals: []
    });

    expect(rfc.rfcId).toBe("rfc_docs_quickstart_001");
    expect(rfc.proposedChanges).toContain("clarify copy");
  });
});
