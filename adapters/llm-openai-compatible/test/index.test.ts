import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { OpenAICompatibleAdapter, adapterId } from "../src/index.js";

describe(adapterId, () => {
  it("generates validated RFCs from chat-compatible JSON output", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rfcId: "rfc_pricing_clarity_001",
                surfaceId: "pricing.hero",
                problem: "New users do not understand Basic vs Pro.",
                hypothesis: "Clearer copy will improve conversion.",
                proposedChanges: ["rewrite hero copy"],
                targetMetric: "pricing_to_signup_conversion",
                guardrailMetrics: ["page_error_rate"],
                risk: "low",
                evidenceCount: 3
              })
            }
          }
        ]
      })
    );
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://llm.example.test/v1",
      apiKey: "secret_test",
      model: "test-model",
      fetch: fetchMock
    });

    const rfc = await adapter.generateRfc({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      signals: []
    });

    expect(rfc.rfcId).toBe("rfc_pricing_clarity_001");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://llm.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret_test"
        })
      })
    );
  });

  it("rejects invalid model output", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rfcId: "missing_required_fields"
              })
            }
          }
        ]
      })
    );
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://llm.example.test/v1",
      model: "test-model",
      fetch: fetchMock
    });

    await expect(
      adapter.generateRfc({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        signals: []
      })
    ).rejects.toThrow();
  });

  it("requires configuration from env", () => {
    expect(() => OpenAICompatibleAdapter.fromEnv({})).toThrow(
      "OpenAI-compatible adapter requires baseUrl"
    );
  });
});
