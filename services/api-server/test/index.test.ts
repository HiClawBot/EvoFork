import { describe, expect, it } from "vitest";
import { InMemoryBranchRegistry } from "@evofork/branch-registry";
import {
  InMemoryMetricEventRepository,
  InMemorySignalRepository
} from "@evofork/signal-hub";
import { buildApiServer, serviceId } from "../src/index.js";

describe(serviceId, () => {
  it("returns health status", async () => {
    const { app } = await createTestServer();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: "ok",
        service: serviceId
      });
    } finally {
      await app.close();
    }
  });

  it("returns validation errors for invalid signal payloads", async () => {
    const { app } = await createTestServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/signals",
        payload: {
          appId: "demo-saas"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "validation_error"
      });
    } finally {
      await app.close();
    }
  });

  it("creates generic signals", async () => {
    const { app } = await createTestServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/signals",
        payload: {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          source: "user_feedback",
          signalType: "confusion",
          text: "I do not understand Basic vs Pro.",
          segmentHints: {
            lifecycle_stage: "new_user"
          },
          piiRemoved: true
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().signal).toMatchObject({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        source: "user_feedback",
        signalType: "confusion",
        piiRemoved: true,
        llmEligible: true
      });
    } finally {
      await app.close();
    }
  });

  it("creates feedback signals and stores them by surface", async () => {
    const { app } = await createTestServer();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/feedback",
        payload: {
          appId: "demo-saas",
          surface: "pricing.hero",
          rating: -1,
          text: "I do not understand Basic vs Pro.",
          context: {
            page: "/pricing",
            lifecycle_stage: "new_user"
          },
          consent: true
        }
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json().signal).toMatchObject({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        source: "user_feedback",
        signalType: "negative_feedback",
        severity: "medium",
        piiRemoved: false,
        llmEligible: false
      });

      const listResponse = await app.inject({
        method: "GET",
        url: "/v1/surfaces/pricing.hero/signals?appId=demo-saas"
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().signals).toHaveLength(1);
      expect(listResponse.json().signals[0]).toMatchObject({
        surfaceId: "pricing.hero",
        text: "I do not understand Basic vs Pro."
      });
    } finally {
      await app.close();
    }
  });

  it("marks non-pii-removed support summaries as not eligible for LLM use", async () => {
    const { app } = await createTestServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/support-summaries",
        payload: {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          signalType: "confusion",
          summary: "New users frequently ask about Basic vs Pro.",
          evidenceCount: 47,
          segmentHints: {
            lifecycle_stage: "new_user"
          },
          piiRemoved: false
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().signal).toMatchObject({
        source: "support_summary",
        piiRemoved: false,
        llmEligible: false
      });
    } finally {
      await app.close();
    }
  });

  it("filters signals by surface and app", async () => {
    const { app, repository } = await createTestServer();

    try {
      await repository.create({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        source: "user_feedback",
        signalType: "confusion",
        piiRemoved: true
      });
      await repository.create({
        appId: "other-app",
        surfaceId: "pricing.hero",
        source: "user_feedback",
        signalType: "confusion",
        piiRemoved: true
      });

      const response = await app.inject({
        method: "GET",
        url: "/v1/surfaces/pricing.hero/signals?appId=demo-saas"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().signals).toHaveLength(1);
      expect(response.json().signals[0].appId).toBe("demo-saas");
    } finally {
      await app.close();
    }
  });

  it("accepts SDK tracking events", async () => {
    const { app } = await createTestServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: {
          appId: "demo-saas",
          event: "variant_exposed",
          surfaceId: "pricing.hero",
          branchId: null,
          userId: "user_123",
          properties: {
            variant: "default"
          }
        }
      });

      expect(response.statusCode).toBe(202);
      expect(response.json().event).toMatchObject({
        appId: "demo-saas",
        event: "variant_exposed",
        surfaceId: "pricing.hero",
        branchId: null,
        properties: {
          variant: "default"
        }
      });
    } finally {
      await app.close();
    }
  });

  it("lists metric events for local observer input building", async () => {
    const { app } = await createTestServer();

    try {
      const payloads = [
        {
          appId: "demo-saas",
          event: "metric_observed",
          surfaceId: "pricing.hero",
          branchId: null,
          sessionId: "session_baseline",
          properties: {
            metric: "pricing_to_signup_conversion",
            value: 0,
            cohort: "baseline",
            direction: "increase"
          }
        },
        {
          appId: "demo-saas",
          event: "metric_observed",
          surfaceId: "pricing.hero",
          branchId: "br_demo_seed",
          sessionId: "session_canary",
          properties: {
            metric: "pricing_to_signup_conversion",
            value: 1,
            cohort: "canary",
            direction: "increase"
          }
        },
        {
          appId: "other-app",
          event: "metric_observed",
          surfaceId: "pricing.hero",
          branchId: "br_demo_seed",
          properties: {
            metric: "pricing_to_signup_conversion",
            value: 1
          }
        }
      ];

      for (const payload of payloads) {
        const createResponse = await app.inject({
          method: "POST",
          url: "/v1/events",
          payload
        });

        expect(createResponse.statusCode).toBe(202);
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/events?appId=demo-saas&surfaceId=pricing.hero&branchId=br_demo_seed&event=metric_observed"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().events).toHaveLength(1);
      expect(response.json().events[0]).toMatchObject({
        appId: "demo-saas",
        surfaceId: "pricing.hero",
        branchId: "br_demo_seed",
        event: "metric_observed",
        properties: {
          metric: "pricing_to_signup_conversion",
          value: 1,
          cohort: "canary"
        }
      });
    } finally {
      await app.close();
    }
  });

  it("creates branches, approves rollout, and resolves matching variants", async () => {
    const { app } = await createTestServer();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/branches",
        payload: {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          branchName: "pricing.hero.new-user-clarity.v1",
          targetSegments: {
            lifecycle_stage: "new_user"
          },
          createdBy: "codex"
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const branch = createResponse.json().branch as { id: string; status: string };
      expect(branch.status).toBe("draft");

      const approveResponse = await app.inject({
        method: "POST",
        url: `/v1/branches/${branch.id}/approve`,
        payload: {
          actor: "maintainer"
        }
      });
      expect(approveResponse.statusCode).toBe(200);
      expect(approveResponse.json().branch.status).toBe("canary");

      const rolloutResponse = await app.inject({
        method: "POST",
        url: `/v1/branches/${branch.id}/rollout`,
        payload: {
          percentage: 100,
          actor: "maintainer"
        }
      });
      expect(rolloutResponse.statusCode).toBe(200);
      expect(rolloutResponse.json().branch.status).toBe("active");

      const resolveResponse = await app.inject({
        method: "POST",
        url: "/v1/variants/resolve",
        payload: {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          userId: "user_123",
          segmentHints: {
            lifecycle_stage: "new_user"
          }
        }
      });

      expect(resolveResponse.statusCode).toBe(200);
      expect(resolveResponse.json()).toMatchObject({
        surfaceId: "pricing.hero",
        variant: "pricing.hero.new-user-clarity.v1",
        branchId: branch.id,
        reason: "matched_segment_and_rollout",
        sticky: true
      });
    } finally {
      await app.close();
    }
  });

  it("lists branch audit logs", async () => {
    const { app } = await createTestServer();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/branches",
        payload: {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          branchName: "pricing.hero.new-user-clarity.v1",
          createdBy: "codex"
        }
      });
      expect(createResponse.statusCode).toBe(201);

      const auditResponse = await app.inject({
        method: "GET",
        url: "/v1/audit-logs?appId=demo-saas"
      });

      expect(auditResponse.statusCode).toBe(200);
      expect(auditResponse.json().auditLogs).toHaveLength(1);
      expect(auditResponse.json().auditLogs[0]).toMatchObject({
        appId: "demo-saas",
        actor: "codex",
        event: "branch_created",
        resourceType: "branch"
      });
    } finally {
      await app.close();
    }
  });

  it("returns default variants for personalization opt-out", async () => {
    const { app } = await createTestServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/variants/resolve",
        payload: {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          userId: "user_123",
          personalizationOptOut: true
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        surfaceId: "pricing.hero",
        variant: "default",
        branchId: null,
        reason: "personalization_opt_out",
        sticky: false
      });
    } finally {
      await app.close();
    }
  });

  it("returns branch state transition errors as 400 responses", async () => {
    const { app } = await createTestServer();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/branches",
        payload: {
          appId: "demo-saas",
          surfaceId: "pricing.hero",
          branchName: "pricing.hero.new-user-clarity.v1"
        }
      });
      const branch = createResponse.json().branch as { id: string };

      const rolloutResponse = await app.inject({
        method: "POST",
        url: `/v1/branches/${branch.id}/rollout`,
        payload: {
          percentage: 10
        }
      });

      expect(rolloutResponse.statusCode).toBe(400);
      expect(rolloutResponse.json()).toMatchObject({
        error: "invalid_branch_transition"
      });
    } finally {
      await app.close();
    }
  });
});

async function createTestServer() {
  const repository = new InMemorySignalRepository();
  const metricEventRepository = new InMemoryMetricEventRepository();
  const branchRegistry = new InMemoryBranchRegistry({
    idGenerator: createIdGenerator("br"),
    clock: fixedClock
  });
  const app = buildApiServer({
    signalRepository: repository,
    metricEventRepository,
    branchRegistry
  });

  await app.ready();

  return {
    app,
    repository,
    metricEventRepository,
    branchRegistry
  };
}

function createIdGenerator(prefix: string): () => string {
  let counter = 0;

  return () => {
    counter += 1;
    return `${prefix}_${counter}`;
  };
}

function fixedClock(): Date {
  return new Date("2026-06-17T00:00:00.000Z");
}
