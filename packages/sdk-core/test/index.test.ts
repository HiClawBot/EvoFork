import { describe, expect, it, vi } from "vitest";
import { EvoClient, moduleId, type FetchLike } from "../src/index.js";

describe(moduleId, () => {
  it("sends feedback with app and session metadata", async () => {
    const fetchMock = createFetchMock(new Response(null, { status: 204 }));
    const client = new EvoClient({
      endpoint: "https://api.example.test/",
      appId: "demo-saas",
      sessionId: "session_123",
      fetch: fetchMock
    });

    await expect(
      client.feedback({
        surface: "pricing.hero",
        signal: "confusion",
        text: "Basic vs Pro is unclear.",
        consent: true,
        context: {
          page: "/pricing"
        }
      })
    ).resolves.toEqual({
      ok: true,
      data: undefined
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/feedback",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(requestBody(fetchMock)).toMatchObject({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      signal: "confusion",
      text: "Basic vs Pro is unclear.",
      consent: true,
      sessionId: "session_123"
    });
  });

  it("sends events with the configured api key", async () => {
    const fetchMock = createFetchMock(new Response(null, { status: 204 }));
    const client = new EvoClient({
      endpoint: "https://api.example.test",
      appId: "demo-saas",
      apiKey: "secret_test",
      sessionId: "session_123",
      fetch: fetchMock
    });

    await expect(client.track("pricing_cta_clicked", { plan: "pro" })).resolves.toEqual({
      ok: true,
      data: undefined
    });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer secret_test"
    });
    expect(requestBody(fetchMock)).toMatchObject({
      appId: "demo-saas",
      event: "pricing_cta_clicked",
      properties: {
        plan: "pro"
      }
    });
  });

  it("does not throw for mutation network failures by default", async () => {
    const fetchMock = createRejectingFetchMock(new Error("network down"));
    const client = new EvoClient({
      endpoint: "https://api.example.test",
      appId: "demo-saas",
      fetch: fetchMock
    });

    await expect(client.track("pricing_viewed")).resolves.toEqual({
      ok: false,
      error: "network down"
    });
  });

  it("resolves variants from the router", async () => {
    const fetchMock = createFetchMock(
      Response.json({
        variant: "pricing.hero.new-user-clarity.v1",
        branchId: "br_123",
        reason: "matched_segment_and_rollout",
        sticky: true
      })
    );
    const client = new EvoClient({
      endpoint: "https://api.example.test",
      appId: "demo-saas",
      sessionId: "session_123",
      fetch: fetchMock
    });

    await expect(
      client.getVariant("pricing.hero", {
        userId: "user_123",
        segmentHints: {
          lifecycle_stage: "new_user"
        }
      })
    ).resolves.toEqual({
      surfaceId: "pricing.hero",
      variant: "pricing.hero.new-user-clarity.v1",
      branchId: "br_123",
      reason: "matched_segment_and_rollout",
      sticky: true
    });

    expect(requestBody(fetchMock)).toMatchObject({
      appId: "demo-saas",
      surfaceId: "pricing.hero",
      userId: "user_123",
      sessionId: "session_123",
      segmentHints: {
        lifecycle_stage: "new_user"
      }
    });
  });

  it("returns default variant on router failure by default", async () => {
    const fetchMock = createRejectingFetchMock(new Error("router unavailable"));
    const client = new EvoClient({
      endpoint: "https://api.example.test",
      appId: "demo-saas",
      fetch: fetchMock
    });

    await expect(client.getVariant("pricing.hero")).resolves.toMatchObject({
      surfaceId: "pricing.hero",
      variant: "default",
      sticky: false
    });
  });

  it("throws in strict mode", async () => {
    const fetchMock = createRejectingFetchMock(new Error("router unavailable"));
    const client = new EvoClient({
      endpoint: "https://api.example.test",
      appId: "demo-saas",
      strict: true,
      fetch: fetchMock
    });

    await expect(client.getVariant("pricing.hero")).rejects.toThrow("router unavailable");
  });
});

function createFetchMock(response: Response) {
  return vi.fn<FetchLike>().mockResolvedValue(response);
}

function createRejectingFetchMock(error: Error) {
  return vi.fn<FetchLike>().mockRejectedValue(error);
}

function requestBody(fetchMock: ReturnType<typeof createFetchMock>): Record<string, unknown> {
  const body = fetchMock.mock.calls[0]?.[1]?.body;

  if (typeof body !== "string") {
    throw new Error("Expected string request body");
  }

  return JSON.parse(body) as Record<string, unknown>;
}
