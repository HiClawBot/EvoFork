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

export type CanaryMetricEventInput = {
  id?: string;
  appId: string;
  event: string;
  surfaceId?: string;
  branchId?: string | null;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
  createdAt?: string;
};

export type BuildCanaryInputFromMetricEventsInput = {
  appId: string;
  surfaceId: string;
  branchId: string;
  branchName?: string;
  rolloutPercentage: number;
  events: CanaryMetricEventInput[];
  minSampleSize?: number;
  observedAt?: string;
  metricEventName?: string;
  metricDirections?: Record<string, MetricDirection>;
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

export function buildCanaryInputFromMetricEvents(
  input: BuildCanaryInputFromMetricEventsInput
): CanaryObservationInput {
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

  if (!Array.isArray(input.events)) {
    throw new Error("events must be an array");
  }

  const metricEventName = input.metricEventName ?? "metric_observed";
  const metrics = new Map<
    string,
    {
      direction: MetricDirection;
      baselineSum: number;
      baselineCount: number;
      canarySum: number;
      canaryCount: number;
      warnRegressionPercent?: number;
      failRegressionPercent?: number;
    }
  >();
  const canarySamples = new Set<string>();
  let anonymousCanarySamples = 0;

  for (const event of input.events) {
    if (event.appId !== input.appId || event.surfaceId !== input.surfaceId) {
      continue;
    }

    if (event.event !== metricEventName) {
      continue;
    }

    const properties = event.properties ?? {};
    const metricName = readMetricName(properties);
    const value = readMetricValue(properties);
    const cohort = readMetricCohort(event, input.branchId);

    if (!metricName || value === undefined || !cohort) {
      continue;
    }

    const direction =
      input.metricDirections?.[metricName] ?? readMetricDirection(properties) ?? "increase";
    const aggregate =
      metrics.get(metricName) ??
      {
        direction,
        baselineSum: 0,
        baselineCount: 0,
        canarySum: 0,
        canaryCount: 0,
        warnRegressionPercent: readOptionalNumber(properties.warnRegressionPercent),
        failRegressionPercent: readOptionalNumber(properties.failRegressionPercent)
      };

    aggregate.direction = direction;

    if (aggregate.warnRegressionPercent === undefined) {
      aggregate.warnRegressionPercent = readOptionalNumber(properties.warnRegressionPercent);
    }

    if (aggregate.failRegressionPercent === undefined) {
      aggregate.failRegressionPercent = readOptionalNumber(properties.failRegressionPercent);
    }

    if (cohort === "baseline") {
      aggregate.baselineSum += value;
      aggregate.baselineCount += 1;
    } else {
      aggregate.canarySum += value;
      aggregate.canaryCount += 1;

      const sampleKey = readSampleKey(event, properties);
      if (sampleKey) {
        canarySamples.add(sampleKey);
      } else {
        anonymousCanarySamples += 1;
      }
    }

    metrics.set(metricName, aggregate);
  }

  const canaryMetrics: CanaryMetricInput[] = [...metrics.entries()]
    .filter(([, metric]) => metric.baselineCount > 0 && metric.canaryCount > 0)
    .map(([name, metric]) => ({
      name,
      baseline: round(metric.baselineSum / metric.baselineCount),
      canary: round(metric.canarySum / metric.canaryCount),
      direction: metric.direction,
      ...(metric.warnRegressionPercent !== undefined
        ? { warnRegressionPercent: metric.warnRegressionPercent }
        : {}),
      ...(metric.failRegressionPercent !== undefined
        ? { failRegressionPercent: metric.failRegressionPercent }
        : {})
    }));

  if (canaryMetrics.length === 0) {
    throw new Error("No complete canary metrics were found");
  }

  return {
    appId: input.appId,
    surfaceId: input.surfaceId,
    branchId: input.branchId,
    ...(input.branchName ? { branchName: input.branchName } : {}),
    rolloutPercentage: input.rolloutPercentage,
    sampleSize: canarySamples.size + anonymousCanarySamples,
    ...(input.minSampleSize !== undefined ? { minSampleSize: input.minSampleSize } : {}),
    metrics: canaryMetrics,
    ...(input.observedAt ? { observedAt: input.observedAt } : {})
  };
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

function readMetricName(properties: Record<string, unknown>): string | undefined {
  const metric = properties.metric ?? properties.metricName ?? properties.name;

  return typeof metric === "string" && metric.trim() !== "" ? metric : undefined;
}

function readMetricValue(properties: Record<string, unknown>): number | undefined {
  const value = properties.value;

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readMetricDirection(properties: Record<string, unknown>): MetricDirection | undefined {
  const direction = properties.direction;

  return direction === "increase" || direction === "decrease" ? direction : undefined;
}

function readMetricCohort(
  event: CanaryMetricEventInput,
  branchId: string
): "baseline" | "canary" | undefined {
  const cohort = event.properties?.cohort;

  if (cohort === "baseline" || cohort === "canary") {
    return cohort;
  }

  if (event.branchId === branchId) {
    return "canary";
  }

  if (event.branchId === null || event.branchId === undefined || event.branchId === "default") {
    return "baseline";
  }

  return undefined;
}

function readSampleKey(
  event: CanaryMetricEventInput,
  properties: Record<string, unknown>
): string | undefined {
  const sample = properties.sampleId;

  if (typeof sample === "string" && sample.trim() !== "") {
    return sample;
  }

  return event.sessionId ?? event.userId ?? event.id;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
