export const serviceId = "@evofork/signal-hub";

export type SignalRecord = {
  id: string;
  appId: string;
  surfaceId: string;
  source: string;
  signalType: string;
  text?: string;
  summary?: string;
  severity?: string;
  evidenceCount: number;
  segmentHints: Record<string, unknown>;
  piiRemoved: boolean;
  llmEligible: boolean;
  createdAt: string;
};

export type CreateSignalInput = {
  appId: string;
  surfaceId: string;
  source: string;
  signalType: string;
  text?: string;
  summary?: string;
  severity?: string;
  evidenceCount?: number;
  segmentHints?: Record<string, unknown>;
  piiRemoved?: boolean;
  llmEligible?: boolean;
};

export type ListSignalsOptions = {
  appId?: string;
  surfaceId: string;
};

export type SignalRepository = {
  create(input: CreateSignalInput): Promise<SignalRecord>;
  listBySurface(options: ListSignalsOptions): Promise<SignalRecord[]>;
  clear(): Promise<void>;
};

export class InMemorySignalRepository implements SignalRepository {
  private readonly records: SignalRecord[] = [];

  async create(input: CreateSignalInput): Promise<SignalRecord> {
    const piiRemoved = input.piiRemoved ?? false;
    const record: SignalRecord = {
      id: createSignalId(),
      appId: input.appId,
      surfaceId: input.surfaceId,
      source: input.source,
      signalType: input.signalType,
      text: input.text,
      summary: input.summary,
      severity: input.severity,
      evidenceCount: input.evidenceCount ?? 1,
      segmentHints: input.segmentHints ?? {},
      piiRemoved,
      llmEligible: input.llmEligible ?? piiRemoved,
      createdAt: new Date().toISOString()
    };

    this.records.push(record);

    return record;
  }

  async listBySurface(options: ListSignalsOptions): Promise<SignalRecord[]> {
    return this.records.filter((record) => {
      if (record.surfaceId !== options.surfaceId) {
        return false;
      }

      return options.appId ? record.appId === options.appId : true;
    });
  }

  async clear(): Promise<void> {
    this.records.splice(0, this.records.length);
  }
}

function createSignalId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `sig_${Math.random().toString(36).slice(2)}`;
}
