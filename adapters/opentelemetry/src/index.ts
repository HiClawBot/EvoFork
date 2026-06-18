import {
  analyzeCanary,
  buildCanaryInputFromMetricEvents,
  type BuildCanaryInputFromMetricEventsInput,
  type CanaryMetricEventInput,
  type CanaryObservationInput,
  type CanaryObservationReport,
  type MetricDirection
} from "@evofork/rollout-observer";

export const adapterId = "@evofork/adapter-opentelemetry";

export type OtelAttributeValue = string | number | boolean | undefined;

export type OtelMetricPoint = {
  name: string;
  value: number;
  attributes?: Record<string, OtelAttributeValue>;
  timestamp?: string;
};

export type OtelObserverBridgeInput = Omit<
  BuildCanaryInputFromMetricEventsInput,
  "events"
> & {
  points: OtelMetricPoint[];
};

export function getAdapterStatus(): string {
  return `${adapterId}: local observer bridge`;
}

export function otelMetricPointsToCanaryEvents(
  input: Pick<OtelObserverBridgeInput, "appId" | "surfaceId" | "branchId" | "points"> & {
    metricDirections?: Record<string, MetricDirection>;
  }
): CanaryMetricEventInput[] {
  if (!Array.isArray(input.points)) {
    throw new Error("points must be an array");
  }

  return input.points.flatMap((point): CanaryMetricEventInput[] => {
    if (!point.name || !Number.isFinite(point.value)) {
      return [];
    }

    const attributes = point.attributes ?? {};
    const branchId = readStringAttribute(attributes, "evofork.branch_id", "branchId");
    const cohort =
      readCohort(attributes) ??
      (branchId === input.branchId
        ? "canary"
        : branchId === undefined || branchId === "default"
          ? "baseline"
          : undefined);

    if (!cohort) {
      return [];
    }

    const direction = input.metricDirections?.[point.name] ?? readDirection(attributes);
    const userId = readStringAttribute(attributes, "evofork.user_id", "userId");
    const sessionId = readStringAttribute(attributes, "evofork.session_id", "sessionId");

    return [
      {
        appId: input.appId,
        event: "metric_observed",
        surfaceId: input.surfaceId,
        branchId: cohort === "canary" ? input.branchId : null,
        ...(userId ? { userId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(point.timestamp ? { createdAt: point.timestamp } : {}),
        properties: {
          metric: point.name,
          value: point.value,
          cohort,
          source: "opentelemetry_local_adapter",
          ...(direction ? { direction } : {})
        }
      }
    ];
  });
}

export function buildCanaryInputFromOtelMetrics(
  input: OtelObserverBridgeInput
): CanaryObservationInput {
  return buildCanaryInputFromMetricEvents({
    ...input,
    events: otelMetricPointsToCanaryEvents(input)
  });
}

export function analyzeOtelCanary(input: OtelObserverBridgeInput): CanaryObservationReport {
  return analyzeCanary(buildCanaryInputFromOtelMetrics(input));
}

function readCohort(
  attributes: Record<string, OtelAttributeValue>
): "baseline" | "canary" | undefined {
  const cohort = readStringAttribute(attributes, "evofork.cohort", "cohort");

  return cohort === "baseline" || cohort === "canary" ? cohort : undefined;
}

function readDirection(
  attributes: Record<string, OtelAttributeValue>
): MetricDirection | undefined {
  const direction = readStringAttribute(attributes, "evofork.direction", "direction");

  return direction === "increase" || direction === "decrease" ? direction : undefined;
}

function readStringAttribute(
  attributes: Record<string, OtelAttributeValue>,
  primary: string,
  fallback: string
): string | undefined {
  const value = attributes[primary] ?? attributes[fallback];

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
