export const moduleId = "@evofork/sdk-core";

export type EvoClientOptions = {
  endpoint: string;
  appId: string;
  apiKey?: string;
  timeoutMs?: number;
  strict?: boolean;
  fetch?: FetchLike;
  sessionId?: string;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type EvoResult<T = undefined> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export type FeedbackInput = {
  surface?: string;
  surfaceId?: string;
  rating?: number;
  signal?: string;
  text?: string;
  context?: Record<string, unknown>;
  consent?: boolean;
  sessionId?: string;
};

export type TrackProperties = Record<string, unknown>;

export type VariantContext = {
  userId?: string;
  anonymousId?: string;
  sessionId?: string;
  segmentHints?: Record<string, string | number | boolean>;
  optOutPersonalization?: boolean;
};

export type VariantResolution = {
  surfaceId: string;
  variant: string;
  branchId?: string;
  reason: string;
  sticky: boolean;
};

type RequestOptions = {
  path: string;
  body: Record<string, unknown>;
};

const defaultTimeoutMs = 2000;
const defaultVariant = "default";

export class EvoClient {
  readonly endpoint: string;
  readonly appId: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly strict: boolean;
  readonly sessionId: string;

  private readonly fetchImpl: FetchLike;

  constructor(options: EvoClientOptions) {
    if (!options.endpoint) {
      throw new Error("EvoClient requires endpoint");
    }

    if (!options.appId) {
      throw new Error("EvoClient requires appId");
    }

    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.appId = options.appId;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    this.strict = options.strict ?? false;
    this.fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
    this.sessionId = options.sessionId ?? createSessionId();

    if (!this.fetchImpl) {
      throw new Error("EvoClient requires a fetch implementation");
    }
  }

  async feedback(input: FeedbackInput): Promise<EvoResult<undefined>> {
    const surfaceId = input.surfaceId ?? input.surface;

    if (!surfaceId) {
      return this.handleFailure(new Error("feedback requires surfaceId or surface"));
    }

    return this.mutate({
      path: "/v1/feedback",
      body: {
        appId: this.appId,
        surfaceId,
        rating: input.rating,
        signal: input.signal,
        text: input.text,
        context: input.context ?? {},
        consent: input.consent ?? false,
        sessionId: input.sessionId ?? this.sessionId
      }
    });
  }

  async track(event: string, properties: TrackProperties = {}): Promise<EvoResult<undefined>> {
    if (!event) {
      return this.handleFailure(new Error("track requires event"));
    }

    return this.mutate({
      path: "/v1/events",
      body: {
        appId: this.appId,
        event,
        properties,
        sessionId: this.sessionId
      }
    });
  }

  async getVariant(
    surfaceId: string,
    context: VariantContext = {}
  ): Promise<VariantResolution> {
    if (!surfaceId) {
      return this.handleVariantFailure(surfaceId, new Error("getVariant requires surfaceId"));
    }

    try {
      const response = await this.requestJson<Partial<VariantResolution>>({
        path: "/v1/variants/resolve",
        body: {
          appId: this.appId,
          surfaceId,
          userId: context.userId,
          anonymousId: context.anonymousId,
          sessionId: context.sessionId ?? this.sessionId,
          segmentHints: context.segmentHints ?? {},
          optOutPersonalization: context.optOutPersonalization ?? false
        }
      });

      return {
        surfaceId,
        variant: response.variant ?? defaultVariant,
        branchId: response.branchId,
        reason: response.reason ?? "resolved",
        sticky: response.sticky ?? false
      };
    } catch (error) {
      return this.handleVariantFailure(surfaceId, error);
    }
  }

  private async mutate(options: RequestOptions): Promise<EvoResult<undefined>> {
    try {
      await this.requestJson(options);

      return {
        ok: true,
        data: undefined
      };
    } catch (error) {
      return this.handleFailure(error);
    }
  }

  private async requestJson<T = unknown>(options: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.endpoint}${options.path}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(options.body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`EvoFork request failed with status ${response.status}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private handleFailure(error: unknown): EvoResult<undefined> {
    if (this.strict) {
      throw normalizeError(error);
    }

    return {
      ok: false,
      error: normalizeError(error).message
    };
  }

  private handleVariantFailure(surfaceId: string, error: unknown): VariantResolution {
    if (this.strict) {
      throw normalizeError(error);
    }

    return {
      surfaceId,
      variant: defaultVariant,
      reason: `fallback_error: ${normalizeError(error).message}`,
      sticky: false
    };
  }
}

export function createEvoClient(options: EvoClientOptions): EvoClient {
  return new EvoClient(options);
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function createSessionId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `evo_${globalThis.crypto.randomUUID()}`;
  }

  return `evo_${Math.random().toString(36).slice(2)}`;
}
