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

export type MetricEventRecord = {
  id: string;
  appId: string;
  event: string;
  surfaceId?: string;
  branchId?: string | null;
  userId?: string;
  sessionId?: string;
  properties: Record<string, unknown>;
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

export type CreateMetricEventInput = {
  appId: string;
  event: string;
  surfaceId?: string;
  branchId?: string | null;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
};

export type ListSignalsOptions = {
  appId?: string;
  surfaceId: string;
};

export type ListMetricEventsOptions = {
  appId?: string;
  surfaceId?: string;
  branchId?: string | null;
  event?: string;
};

export type SignalRepository = {
  create(input: CreateSignalInput): Promise<SignalRecord>;
  listBySurface(options: ListSignalsOptions): Promise<SignalRecord[]>;
  clear(): Promise<void>;
};

export type MetricEventRepository = {
  create(input: CreateMetricEventInput): Promise<MetricEventRecord>;
  list(options?: ListMetricEventsOptions): Promise<MetricEventRecord[]>;
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

export class InMemoryMetricEventRepository implements MetricEventRepository {
  private readonly records: MetricEventRecord[] = [];

  async create(input: CreateMetricEventInput): Promise<MetricEventRecord> {
    const record: MetricEventRecord = {
      id: createSignalId(),
      appId: input.appId,
      event: input.event,
      surfaceId: input.surfaceId,
      branchId: input.branchId,
      userId: input.userId,
      sessionId: input.sessionId,
      properties: input.properties ?? {},
      createdAt: new Date().toISOString()
    };

    this.records.push(record);

    return cloneMetricEvent(record);
  }

  async list(options: ListMetricEventsOptions = {}): Promise<MetricEventRecord[]> {
    return this.records
      .filter((record) => !options.appId || record.appId === options.appId)
      .filter((record) => !options.surfaceId || record.surfaceId === options.surfaceId)
      .filter((record) => !options.event || record.event === options.event)
      .filter((record) => {
        if (options.branchId === undefined) {
          return true;
        }

        return (record.branchId ?? null) === options.branchId;
      })
      .map(cloneMetricEvent);
  }

  async clear(): Promise<void> {
    this.records.splice(0, this.records.length);
  }
}

function cloneMetricEvent(record: MetricEventRecord): MetricEventRecord {
  return {
    ...record,
    properties: { ...record.properties }
  };
}

function createSignalId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `sig_${Math.random().toString(36).slice(2)}`;
}
