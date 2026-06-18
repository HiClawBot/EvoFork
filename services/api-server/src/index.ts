import { pathToFileURL } from "node:url";
import {
  BranchRegistryError,
  InMemoryBranchRegistry,
  type BranchRegistry,
  type BranchRecord,
  type BranchStatus
} from "@evofork/branch-registry";
import { type EvoManifest } from "@evofork/manifest-parser";
import { evaluatePolicy, type PolicyDecision } from "@evofork/policy-engine";
import { resolveVariant } from "@evofork/router";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from "fastify";
import {
  InMemoryMetricEventRepository,
  InMemorySignalRepository,
  type MetricEventRepository,
  type SignalRepository
} from "@evofork/signal-hub";
import { z, ZodError, type ZodSchema } from "zod";

export const serviceId = "@evofork/api-server";

export type ApiServerOptions = {
  logger?: boolean;
  manifest?: EvoManifest;
  signalRepository?: SignalRepository;
  metricEventRepository?: MetricEventRepository;
  branchRegistry?: BranchRegistry;
};

const recordSchema = z.record(z.unknown());
const segmentValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const targetSegmentsSchema = z.record(z.union([segmentValueSchema, z.array(segmentValueSchema)]));
const segmentHintsSchema = z.record(segmentValueSchema);
const branchStatusSchema = z.enum(["draft", "canary", "active", "reverted", "sunset"]);

const signalSchema = z.object({
  appId: z.string().min(1),
  surfaceId: z.string().min(1),
  source: z.string().min(1),
  signalType: z.string().min(1),
  text: z.string().optional(),
  summary: z.string().optional(),
  severity: z.string().optional(),
  evidenceCount: z.number().int().positive().optional(),
  segmentHints: recordSchema.optional(),
  piiRemoved: z.boolean().optional()
});

const feedbackSchema = z
  .object({
    appId: z.string().min(1),
    surface: z.string().min(1).optional(),
    surfaceId: z.string().min(1).optional(),
    rating: z.number().optional(),
    signal: z.string().min(1).optional(),
    text: z.string().optional(),
    context: recordSchema.optional(),
    consent: z.boolean().optional()
  })
  .superRefine((input, context) => {
    if (!input.surface && !input.surfaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "feedback requires surface or surfaceId",
        path: ["surface"]
      });
    }
  });

const supportSummarySchema = z.object({
  appId: z.string().min(1),
  surfaceId: z.string().min(1),
  signalType: z.string().min(1),
  summary: z.string().min(1),
  evidenceCount: z.number().int().positive().optional(),
  segmentHints: recordSchema.optional(),
  piiRemoved: z.boolean()
});

const eventSchema = z.object({
  appId: z.string().min(1),
  event: z.string().min(1),
  surfaceId: z.string().min(1).optional(),
  branchId: z.string().min(1).nullable().optional(),
  userId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  properties: recordSchema.optional()
});

const surfaceParamsSchema = z.object({
  surfaceId: z.string().min(1)
});

const listSignalsQuerySchema = z.object({
  appId: z.string().min(1).optional()
});

const listEventsQuerySchema = z.object({
  appId: z.string().min(1).optional(),
  surfaceId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  event: z.string().min(1).optional()
});

const listBranchesQuerySchema = z.object({
  appId: z.string().min(1).optional(),
  surfaceId: z.string().min(1).optional(),
  status: branchStatusSchema.optional()
});

const listAuditLogsQuerySchema = z.object({
  appId: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional()
});

const branchParamsSchema = z.object({
  id: z.string().min(1)
});

const createBranchSchema = z.object({
  appId: z.string().min(1),
  surfaceId: z.string().min(1),
  rfcId: z.string().min(1).optional(),
  branchName: z.string().min(1),
  baseVersion: z.string().min(1).optional(),
  gitBranch: z.string().min(1).optional(),
  commitHash: z.string().min(1).optional(),
  prUrl: z.string().url().optional(),
  targetSegments: targetSegmentsSchema.optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  priority: z.number().int().optional(),
  evalReport: z.unknown().optional(),
  createdBy: z.string().min(1).optional()
});

const approveBranchSchema = z
  .object({
    actor: z.string().min(1).optional(),
    approvedBy: z.string().min(1).optional()
  })
  .default({});

const rolloutBranchSchema = z.object({
  percentage: z.number().int().min(0).max(100),
  actor: z.string().min(1).optional()
});

const promoteBranchSchema = z
  .object({
    actor: z.string().min(1).optional(),
    approved: z.boolean().optional(),
    humanApproved: z.boolean().optional(),
    evalPassed: z.boolean().optional()
  })
  .default({});

const revertBranchSchema = z.object({
  reason: z.string().min(1),
  actor: z.string().min(1).optional()
});

const sunsetBranchSchema = z
  .object({
    actor: z.string().min(1).optional()
  })
  .default({});

const resolveVariantSchema = z.object({
  appId: z.string().min(1),
  surfaceId: z.string().min(1),
  userId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  segmentHints: segmentHintsSchema.optional(),
  personalizationOptOut: z.boolean().optional(),
  optOutPersonalization: z.boolean().optional()
});

export function buildApiServer(options: ApiServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false
  });
  const signalRepository = options.signalRepository ?? new InMemorySignalRepository();
  const metricEventRepository =
    options.metricEventRepository ?? new InMemoryMetricEventRepository();
  const branchRegistry = options.branchRegistry ?? new InMemoryBranchRegistry();

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error: "validation_error",
        issues: error.issues
      });
      return;
    }

    if (error instanceof BranchRegistryError) {
      reply.status(error.statusCode).send({
        error: error.code,
        message: error.message
      });
      return;
    }

    const normalizedError = normalizeError(error);

    reply.status(500).send({
      error: "internal_server_error",
      message: normalizedError.message
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: serviceId
  }));

  app.register(
    async (v1) => {
      // TODO: add authentication middleware before any production deployment.
      v1.post("/signals", async (request, reply) => {
        const input = parseBody(signalSchema, request);
        const signal = await signalRepository.create({
          appId: input.appId,
          surfaceId: input.surfaceId,
          source: input.source,
          signalType: input.signalType,
          text: input.text,
          summary: input.summary,
          severity: input.severity,
          evidenceCount: input.evidenceCount,
          segmentHints: input.segmentHints,
          piiRemoved: input.piiRemoved ?? false
        });

        return reply.status(201).send({ signal });
      });

      v1.post("/feedback", async (request, reply) => {
        const input = parseBody(feedbackSchema, request);
        const surfaceId = input.surfaceId ?? input.surface;
        const signal = await signalRepository.create({
          appId: input.appId,
          surfaceId: surfaceId as string,
          source: "user_feedback",
          signalType: input.signal ?? feedbackSignalType(input.rating),
          text: input.text,
          severity: feedbackSeverity(input.rating),
          segmentHints: input.context,
          piiRemoved: false,
          llmEligible: false
        });

        return reply.status(201).send({ signal });
      });

      v1.post("/support-summaries", async (request, reply) => {
        const input = parseBody(supportSummarySchema, request);
        const signal = await signalRepository.create({
          appId: input.appId,
          surfaceId: input.surfaceId,
          source: "support_summary",
          signalType: input.signalType,
          summary: input.summary,
          evidenceCount: input.evidenceCount,
          segmentHints: input.segmentHints,
          piiRemoved: input.piiRemoved,
          llmEligible: input.piiRemoved
        });

        return reply.status(201).send({ signal });
      });

      v1.get("/surfaces/:surfaceId/signals", async (request, reply) => {
        const params = surfaceParamsSchema.parse(request.params);
        const query = listSignalsQuerySchema.parse(request.query);
        const signals = await signalRepository.listBySurface({
          surfaceId: params.surfaceId,
          appId: query.appId
        });

        return reply.send({ signals });
      });

      v1.post("/events", async (request, reply) => {
        const input = parseBody(eventSchema, request);
        const event = await metricEventRepository.create({
          appId: input.appId,
          event: input.event,
          surfaceId: input.surfaceId,
          branchId: input.branchId,
          userId: input.userId,
          sessionId: input.sessionId,
          properties: input.properties
        });

        return reply.status(202).send({ event });
      });

      v1.get("/events", async (request, reply) => {
        const query = listEventsQuerySchema.parse(request.query);
        const events = await metricEventRepository.list({
          appId: query.appId,
          surfaceId: query.surfaceId,
          branchId: query.branchId,
          event: query.event
        });

        return reply.send({ events });
      });

      v1.get("/branches", async (request, reply) => {
        const query = listBranchesQuerySchema.parse(request.query);
        const branches = await branchRegistry.list({
          appId: query.appId,
          surfaceId: query.surfaceId,
          statuses: query.status ? ([query.status] as BranchStatus[]) : undefined
        });

        return reply.send({ branches });
      });

      v1.get("/audit-logs", async (request, reply) => {
        const query = listAuditLogsQuerySchema.parse(request.query);
        const auditLogs = await branchRegistry.listAuditLogs(query);

        return reply.send({ auditLogs });
      });

      v1.post("/branches", async (request, reply) => {
        const input = parseBody(createBranchSchema, request);
        const branch = await branchRegistry.create(input);

        return reply.status(201).send({ branch });
      });

      v1.get("/branches/:id", async (request, reply) => {
        const params = branchParamsSchema.parse(request.params);
        const branch = await branchRegistry.get(params.id);

        if (!branch) {
          return reply.status(404).send({
            error: "branch_not_found",
            message: `Branch not found: ${params.id}`
          });
        }

        return reply.send({ branch });
      });

      v1.post("/branches/:id/approve", async (request, reply) => {
        const params = branchParamsSchema.parse(request.params);
        const input = parseBody(approveBranchSchema, request);
        const branch = await branchRegistry.approve(params.id, input);

        return reply.send({ branch });
      });

      v1.post("/branches/:id/rollout", async (request, reply) => {
        const params = branchParamsSchema.parse(request.params);
        const input = parseBody(rolloutBranchSchema, request);
        const branch = await branchRegistry.rollout(params.id, input);

        return reply.send({ branch });
      });

      v1.post("/branches/:id/promote", async (request, reply) => {
        const params = branchParamsSchema.parse(request.params);
        const input = parseBody(promoteBranchSchema, request) ?? {};
        const actor = input.actor ?? "maintainer";
        const branch = await requireApiBranch(branchRegistry, params.id);
        const manifest = requirePolicyManifest(options.manifest);
        const policyDecision = evaluatePolicy({
          manifest,
          surfaceId: branch.surfaceId,
          action: "promote",
          rolloutPercentage: 100,
          actor,
          humanApproved: input.humanApproved ?? input.approved ?? false
        });
        const policyAuditLog = await recordApiPolicyAudit(
          branchRegistry,
          branch,
          actor,
          policyDecision
        );

        if (!policyDecision.allowed) {
          return reply.status(400).send({
            error: "policy_blocked",
            policyDecision,
            auditLog: policyAuditLog
          });
        }

        if (!branchEvalPassed(branch) && !input.evalPassed) {
          const auditLog = await branchRegistry.recordAudit(branch.id, {
            actor,
            event: "eval_blocked",
            payload: {
              action: "promote",
              reason: "Eval Gate must pass before promotion."
            }
          });

          return reply.status(400).send({
            error: "eval_gate_required",
            auditLog
          });
        }

        const evalAuditLog = await branchRegistry.recordAudit(branch.id, {
          actor,
          event: "eval_allowed",
          payload: {
            action: "promote",
            source: input.evalPassed ? "api_request" : "branch_eval_report"
          }
        });
        const promoted = await branchRegistry.promote(params.id, { actor });

        return reply.send({
          branch: promoted,
          policyDecision,
          policyAuditLog,
          evalAuditLog
        });
      });

      v1.post("/branches/:id/revert", async (request, reply) => {
        const params = branchParamsSchema.parse(request.params);
        const input = parseBody(revertBranchSchema, request);
        const branch = await branchRegistry.revert(params.id, input);

        return reply.send({ branch });
      });

      v1.post("/branches/:id/sunset", async (request, reply) => {
        const params = branchParamsSchema.parse(request.params);
        const input = parseBody(sunsetBranchSchema, request) ?? {};
        const actor = input.actor ?? "maintainer";
        const branch = await requireApiBranch(branchRegistry, params.id);
        const manifest = requirePolicyManifest(options.manifest);
        const policyDecision = evaluatePolicy({
          manifest,
          surfaceId: branch.surfaceId,
          action: "sunset",
          actor,
          humanApproved: true
        });
        const policyAuditLog = await recordApiPolicyAudit(
          branchRegistry,
          branch,
          actor,
          policyDecision
        );

        if (!policyDecision.allowed) {
          return reply.status(400).send({
            error: "policy_blocked",
            policyDecision,
            auditLog: policyAuditLog
          });
        }

        const updatedBranch = await branchRegistry.sunset(params.id, { actor });

        return reply.send({
          branch: updatedBranch,
          policyDecision,
          policyAuditLog
        });
      });

      v1.post("/variants/resolve", async (request, reply) => {
        const input = parseBody(resolveVariantSchema, request);
        const branches = await branchRegistry.list({
          appId: input.appId,
          surfaceId: input.surfaceId,
          statuses: ["canary", "active"]
        });
        const resolved = resolveVariant(
          {
            ...input,
            personalizationOptOut:
              input.personalizationOptOut ?? input.optOutPersonalization ?? false
          },
          branches
        );

        return reply.send(resolved);
      });
    },
    {
      prefix: "/v1"
    }
  );

  return app;
}

function parseBody<T>(schema: ZodSchema<T>, request: FastifyRequest): T {
  return schema.parse(request.body);
}

async function requireApiBranch(
  branchRegistry: BranchRegistry,
  id: string
): Promise<BranchRecord> {
  const branch = await branchRegistry.get(id);

  if (!branch) {
    throw new BranchRegistryError("branch_not_found", `Branch not found: ${id}`, 404);
  }

  return branch;
}

function requirePolicyManifest(manifest: EvoManifest | undefined): EvoManifest {
  if (!manifest) {
    throw new BranchRegistryError(
      "manifest_required",
      "A manifest is required for policy-gated branch actions"
    );
  }

  return manifest;
}

async function recordApiPolicyAudit(
  branchRegistry: BranchRegistry,
  branch: BranchRecord,
  actor: string,
  policyDecision: PolicyDecision
) {
  return await branchRegistry.recordAudit(branch.id, {
    actor,
    event: policyDecision.audit.event,
    payload: {
      ...policyDecision.audit.payload,
      reasons: policyDecision.reasons,
      requiredApprovals: policyDecision.requiredApprovals
    }
  });
}

function branchEvalPassed(branch: BranchRecord): boolean {
  return isRecord(branch.evalReport) && branch.evalReport.status === "passed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function feedbackSignalType(rating: number | undefined): string {
  if (typeof rating === "number" && rating < 0) {
    return "negative_feedback";
  }

  return "feedback";
}

function feedbackSeverity(rating: number | undefined): string | undefined {
  if (typeof rating !== "number") {
    return undefined;
  }

  if (rating <= -2) {
    return "high";
  }

  if (rating < 0) {
    return "medium";
  }

  return "low";
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
}

if (isDirectRun()) {
  const port = Number(process.env.PORT ?? 3333);
  const host = process.env.HOST ?? "127.0.0.1";
  const app = buildApiServer({ logger: true });

  app.listen({ port, host }).catch((error) => {
    app.log.error(error);
    process.exitCode = 1;
  });
}
