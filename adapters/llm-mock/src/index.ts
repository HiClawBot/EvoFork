export const adapterId = "@evofork/adapter-llm-mock";

export type RfcRisk = "low" | "medium" | "high";

export type LlmSignal = {
  surfaceId: string;
  text?: string;
  summary?: string;
  signalType?: string;
  evidenceCount?: number;
  segmentHints?: Record<string, unknown>;
};

export type RfcDraft = {
  rfcId: string;
  surfaceId: string;
  problem: string;
  hypothesis: string;
  proposedChanges: string[];
  targetMetric: string;
  guardrailMetrics: string[];
  risk: RfcRisk;
  evidenceCount: number;
};

export type GenerateRfcInput = {
  appId: string;
  surfaceId: string;
  signals: LlmSignal[];
  targetMetric?: string;
  guardrailMetrics?: string[];
};

export type LlmAdapter = {
  generateRfc(input: GenerateRfcInput): Promise<RfcDraft>;
};

export class MockLlmAdapter implements LlmAdapter {
  async generateRfc(input: GenerateRfcInput): Promise<RfcDraft> {
    if (input.surfaceId === "pricing.hero") {
      return pricingHeroRfc(input);
    }

    return genericRfc(input);
  }
}

export function createMockLlmAdapter(): MockLlmAdapter {
  return new MockLlmAdapter();
}

function pricingHeroRfc(input: GenerateRfcInput): RfcDraft {
  return {
    rfcId: "rfc_pricing_clarity_001",
    surfaceId: input.surfaceId,
    problem: "New users do not understand the difference between Basic and Pro plans.",
    hypothesis:
      "If the pricing hero explains plan differences with role-specific language, pricing-to-signup conversion will improve.",
    proposedChanges: [
      "rewrite hero copy around user intent",
      "add concise Basic vs Pro differentiation",
      "make the primary CTA clearer for new users"
    ],
    targetMetric: input.targetMetric ?? "pricing_to_signup_conversion",
    guardrailMetrics: input.guardrailMetrics ?? [
      "page_error_rate",
      "support_ticket_rate",
      "p95_latency"
    ],
    risk: "low",
    evidenceCount: countEvidence(input.signals)
  };
}

function genericRfc(input: GenerateRfcInput): RfcDraft {
  return {
    rfcId: `rfc_${input.surfaceId.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_001`,
    surfaceId: input.surfaceId,
    problem: `Signals indicate friction on ${input.surfaceId}.`,
    hypothesis: "A small manifest-scoped improvement can reduce user friction without increasing risk.",
    proposedChanges: ["clarify copy", "simplify layout", "preserve existing behavior"],
    targetMetric: input.targetMetric ?? "user_success_rate",
    guardrailMetrics: input.guardrailMetrics ?? ["error_rate", "p95_latency"],
    risk: "low",
    evidenceCount: countEvidence(input.signals)
  };
}

function countEvidence(signals: LlmSignal[]): number {
  return signals.reduce((total, signal) => total + (signal.evidenceCount ?? 1), 0);
}
