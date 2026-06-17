import {
  MockLlmAdapter,
  type GenerateRfcInput,
  type LlmAdapter,
  type LlmSignal,
  type RfcDraft
} from "@evofork/adapter-llm-mock";
import type { EvoSurface } from "@evofork/manifest-parser";
import type { SignalRecord } from "@evofork/signal-hub";

export const serviceId = "@evofork/insight-worker";

export type StoredRfc = RfcDraft & {
  appId: string;
  createdAt: string;
};

export type AuditLogRecord = {
  id: string;
  appId: string;
  actor: string;
  event: string;
  resourceType?: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RfcRepository = {
  save(rfc: StoredRfc): Promise<StoredRfc>;
  findById(id: string): Promise<StoredRfc | undefined>;
};

export type AuditLogRepository = {
  write(record: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord>;
  list(): Promise<AuditLogRecord[]>;
};

export type GenerateInsightInput = {
  appId: string;
  surface: EvoSurface;
  signals: SignalRecord[];
  llmAdapter?: LlmAdapter;
  rfcRepository?: RfcRepository;
  auditLogRepository?: AuditLogRepository;
};

export class InMemoryRfcRepository implements RfcRepository {
  private readonly records = new Map<string, StoredRfc>();

  async save(rfc: StoredRfc): Promise<StoredRfc> {
    this.records.set(rfc.rfcId, rfc);
    return rfc;
  }

  async findById(id: string): Promise<StoredRfc | undefined> {
    return this.records.get(id);
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly records: AuditLogRecord[] = [];

  async write(record: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord> {
    const storedRecord: AuditLogRecord = {
      ...record,
      id: createAuditId(),
      createdAt: new Date().toISOString()
    };

    this.records.push(storedRecord);
    return storedRecord;
  }

  async list(): Promise<AuditLogRecord[]> {
    return [...this.records];
  }
}

export async function generateInsightRfc(input: GenerateInsightInput): Promise<StoredRfc> {
  const adapter = input.llmAdapter ?? new MockLlmAdapter();
  const rfcRepository = input.rfcRepository ?? new InMemoryRfcRepository();
  const auditLogRepository = input.auditLogRepository ?? new InMemoryAuditLogRepository();
  const rfc = await adapter.generateRfc(toAdapterInput(input));
  const storedRfc = await rfcRepository.save({
    ...rfc,
    appId: input.appId,
    createdAt: new Date().toISOString()
  });

  await auditLogRepository.write({
    appId: input.appId,
    actor: serviceId,
    event: "rfc_generated",
    resourceType: "rfc",
    resourceId: storedRfc.rfcId,
    payload: {
      surfaceId: storedRfc.surfaceId,
      evidenceCount: storedRfc.evidenceCount,
      risk: storedRfc.risk
    }
  });

  return storedRfc;
}

function toAdapterInput(input: GenerateInsightInput): GenerateRfcInput {
  return {
    appId: input.appId,
    surfaceId: input.surface.id,
    signals: input.signals.map(toLlmSignal),
    targetMetric: input.surface.target_metrics?.primary,
    guardrailMetrics: input.surface.target_metrics?.guardrails
  };
}

function toLlmSignal(signal: SignalRecord): LlmSignal {
  return {
    surfaceId: signal.surfaceId,
    text: signal.text,
    summary: signal.summary,
    signalType: signal.signalType,
    evidenceCount: signal.evidenceCount,
    segmentHints: signal.segmentHints
  };
}

function createAuditId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `audit_${Math.random().toString(36).slice(2)}`;
}
