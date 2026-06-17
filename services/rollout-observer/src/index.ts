export const serviceId = "@evofork/rollout-observer";

export type MetricDirection = "increase" | "decrease";

export type CanaryMetricInput = {
  name: string;
  baseline: number;
  canary: number;
  direction: MetricDirection;
  warnRegressionPercent?: number;
  failRegressionPercent?: number;
};

export type CanaryObservationInput = {
  appId: string;
  surfaceId: string;
  branchId: string;
  branchName?: string;
  rolloutPercentage: number;
  sampleSize: number;
  minSampleSize?: number;
  metrics: CanaryMetricInput[];
  guardrailFailures?: string[];
  observedAt?: string;
};

export type MetricObservation = {
  name: string;
  baseline: number;
  canary: number;
  direction: MetricDirection;
  changePercent: number;
  regressionPercent: number;
  status: "passed" | "warning" | "failed";
  reason: string;
};

export type CanaryObservationReport = {
  status: "passed" | "warning" | "failed";
  recommendation: "promote" | "hold" | "rollback";
  appId: string;
  surfaceId: string;
  branchId: string;
  branchName?: string;
  rolloutPercentage: number;
  sampleSize: number;
  minSampleSize: number;
  observedAt: string;
  reasons: string[];
  metrics: MetricObservation[];
  audit: {
    event: "canary_observation_completed";
    resourceType: "branch";
    resourceId: string;
    payload: Record<string, unknown>;
  };
};

export type CanaryFixtureId = "healthy" | "regression" | "insufficient";

const defaultMinSampleSize = 100;
const defaultWarnRegressionPercent = 5;
const defaultFailRegressionPercent = 10;

const canaryFixtures: Record<CanaryFixtureId, CanaryObservationInput> = {
  healthy: {
    appId: "demo-saas",
    surfaceId: "pricing.hero",
    branchId: "br_demo_seed",
    branchName: "pricing.hero.new-user-clarity.v1",
    rolloutPercentage: 25,
    sampleSize: 420,
    metrics: [
      {
        name: "pricing_to_signup_conversion",
        baseline: 0.124,
        canary: 0.138,
        direction: "increase"
      },
      {
        name: "page_error_rate",
        baseline: 0.012,
        canary: 0.009,
        direction: "decrease"
      },
      {
        name: "p95_latency_ms",
        baseline: 420,
        canary: 398,
        direction: "decrease"
      }
    ]
  },
  regression: {
    appId: "demo-saas",
    surfaceId: "pricing.hero",
    branchId: "br_demo_seed",
    branchName: "pricing.hero.new-user-clarity.v1",
    rolloutPercentage: 25,
    sampleSize: 360,
    metrics: [
      {
        name: "pricing_to_signup_conversion",
        baseline: 0.124,
        canary: 0.119,
        direction: "increase"
      },
      {
        name: "support_ticket_rate",
        baseline: 0.03,
        canary: 0.052,
        direction: "decrease",
        failRegressionPercent: 20
      }
    ]
  },
  insufficient: {
    appId: "demo-saas",
    surfaceId: "pricing.hero",
    branchId: "br_demo_seed",
    branchName: "pricing.hero.new-user-clarity.v1",
    rolloutPercentage: 5,
    sampleSize: 24,
    minSampleSize: 100,
    metrics: [
      {
        name: "pricing_to_signup_conversion",
        baseline: 0.124,
        canary: 0.14,
        direction: "increase"
      }
    ]
  }
};

export function analyzeCanary(input: CanaryObservationInput): CanaryObservationReport {
  validateInput(input);

  const minSampleSize = input.minSampleSize ?? defaultMinSampleSize;
  const metricReports = input.metrics.map(analyzeMetric);
  const reasons: string[] = [];
  const guardrailFailures = input.guardrailFailures ?? [];

  if (input.sampleSize < minSampleSize) {
    reasons.push(`Sample size ${input.sampleSize} is below minimum ${minSampleSize}.`);
  }

  for (const failure of guardrailFailures) {
    reasons.push(`Guardrail failed: ${failure}`);
  }

  for (const metric of metricReports) {
    if (metric.status !== "passed") {
      reasons.push(metric.reason);
    }
  }

  const hasFailedMetric = metricReports.some((metric) => metric.status === "failed");
  const hasWarningMetric = metricReports.some((metric) => metric.status === "warning");
  const shouldRollback = guardrailFailures.length > 0 || hasFailedMetric;
  const shouldHold = !shouldRollback && (input.sampleSize < minSampleSize || hasWarningMetric);
  const status = shouldRollback ? "failed" : shouldHold ? "warning" : "passed";
  const recommendation = shouldRollback ? "rollback" : shouldHold ? "hold" : "promote";
  const observedAt = input.observedAt ?? new Date().toISOString();
  const report: CanaryObservationReport = {
    status,
    recommendation,
    appId: input.appId,
    surfaceId: input.surfaceId,
    branchId: input.branchId,
    rolloutPercentage: input.rolloutPercentage,
    sampleSize: input.sampleSize,
    minSampleSize,
    observedAt,
    reasons: reasons.length > 0 ? unique(reasons) : ["Canary metrics are within thresholds."],
    metrics: metricReports,
    audit: {
      event: "canary_observation_completed",
      resourceType: "branch",
      resourceId: input.branchId,
      payload: {
        surfaceId: input.surfaceId,
        rolloutPercentage: input.rolloutPercentage,
        sampleSize: input.sampleSize,
        minSampleSize,
        status,
        recommendation,
        reasons: reasons.length > 0 ? unique(reasons) : []
      }
    },
    ...(input.branchName ? { branchName: input.branchName } : {})
  };

  return report;
}

export function listCanaryFixtures(): Array<{ id: CanaryFixtureId; input: CanaryObservationInput }> {
  return (Object.keys(canaryFixtures) as CanaryFixtureId[]).map((id) => ({
    id,
    input: cloneInput(canaryFixtures[id])
  }));
}

export function getCanaryFixture(id: CanaryFixtureId): CanaryObservationInput {
  return cloneInput(canaryFixtures[id]);
}

export function isCanaryFixtureId(value: string): value is CanaryFixtureId {
  return value === "healthy" || value === "regression" || value === "insufficient";
}

function analyzeMetric(metric: CanaryMetricInput): MetricObservation {
  const warnThreshold = metric.warnRegressionPercent ?? defaultWarnRegressionPercent;
  const failThreshold = metric.failRegressionPercent ?? defaultFailRegressionPercent;
  const changePercent = percentChange(metric.baseline, metric.canary);
  const regressionPercent = metric.direction === "increase" ? -changePercent : changePercent;
  const status =
    regressionPercent >= failThreshold
      ? "failed"
      : regressionPercent >= warnThreshold
        ? "warning"
        : "passed";
  const reason =
    status === "passed"
      ? `${metric.name} is within threshold.`
      : `${metric.name} regressed ${round(regressionPercent)}% for ${metric.direction}-is-better metric.`;

  return {
    name: metric.name,
    baseline: metric.baseline,
    canary: metric.canary,
    direction: metric.direction,
    changePercent: round(changePercent),
    regressionPercent: round(Math.max(0, regressionPercent)),
    status,
    reason
  };
}

function validateInput(input: CanaryObservationInput): void {
  if (!input.appId || !input.surfaceId || !input.branchId) {
    throw new Error("appId, surfaceId, and branchId are required");
  }

  if (
    !Number.isInteger(input.rolloutPercentage) ||
    input.rolloutPercentage < 0 ||
    input.rolloutPercentage > 100
  ) {
    throw new Error("rolloutPercentage must be an integer from 0 to 100");
  }

  if (!Number.isInteger(input.sampleSize) || input.sampleSize < 0) {
    throw new Error("sampleSize must be a non-negative integer");
  }

  if (input.minSampleSize !== undefined && (!Number.isInteger(input.minSampleSize) || input.minSampleSize < 1)) {
    throw new Error("minSampleSize must be a positive integer");
  }

  if (!Array.isArray(input.metrics)) {
    throw new Error("metrics must be an array");
  }

  if (input.metrics.length === 0) {
    throw new Error("At least one metric is required");
  }

  for (const metric of input.metrics) {
    if (!metric.name || !Number.isFinite(metric.baseline) || !Number.isFinite(metric.canary)) {
      throw new Error("Each metric requires name, baseline, and canary values");
    }

    if (metric.direction !== "increase" && metric.direction !== "decrease") {
      throw new Error(`Invalid metric direction for ${metric.name}`);
    }
  }
}

function percentChange(baseline: number, canary: number): number {
  const denominator = Math.abs(baseline) > 0 ? Math.abs(baseline) : 1;

  return ((canary - baseline) / denominator) * 100;
}

function cloneInput(input: CanaryObservationInput): CanaryObservationInput {
  return {
    ...input,
    metrics: input.metrics.map((metric) => ({ ...metric })),
    ...(input.guardrailFailures ? { guardrailFailures: [...input.guardrailFailures] } : {})
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
