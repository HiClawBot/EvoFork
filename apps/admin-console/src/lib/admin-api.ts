import { readDemoSeed } from "./demo-state";

export type AdminSignal = {
  id: string;
  appId: string;
  surfaceId: string;
  signalType: string;
  text?: string;
  summary?: string;
};

export type AdminBranch = {
  id: string;
  appId: string;
  surfaceId: string;
  branchName: string;
  status: string;
  rolloutPercentage: number;
  evalReport?: unknown;
};

export type AdminAuditLog = {
  id: string;
  appId: string;
  actor: string;
  event: string;
  resourceId: string;
  payload?: Record<string, unknown>;
};

export type AdminSnapshot = {
  apiAvailable: boolean;
  seedLoaded: boolean;
  signals: AdminSignal[];
  branches: AdminBranch[];
  auditLogs: AdminAuditLog[];
};

export type DemoActionResult = {
  ok: boolean;
  action?: string;
  error?: string;
  response?: unknown;
  rfc?: unknown;
  pr?: unknown;
  evalReport?: unknown;
  branch?: unknown;
};

const defaultApiUrl = "http://127.0.0.1:3333";

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const [signals, branches, auditLogs] = await Promise.all([
    getApiJson<{ signals: AdminSignal[] }>(
      "/v1/surfaces/pricing.hero/signals?appId=demo-saas",
      { signals: [] }
    ),
    getApiJson<{ branches: AdminBranch[] }>("/v1/branches?appId=demo-saas", {
      branches: []
    }),
    getApiJson<{ auditLogs: AdminAuditLog[] }>("/v1/audit-logs?appId=demo-saas", {
      auditLogs: []
    })
  ]);
  const seed = await readDemoSeed();
  const useSeedSignals = signals.body.signals.length === 0 && seed.signals.length > 0;
  const useSeedBranches = branches.body.branches.length === 0 && seed.branches.length > 0;
  const useSeedAuditLogs = auditLogs.body.auditLogs.length === 0 && seed.auditLogs.length > 0;

  return {
    apiAvailable: signals.ok && branches.ok && auditLogs.ok,
    seedLoaded: useSeedSignals || useSeedBranches || useSeedAuditLogs,
    signals: useSeedSignals ? seed.signals : signals.body.signals,
    branches: useSeedBranches ? seed.branches : branches.body.branches,
    auditLogs: useSeedAuditLogs ? seed.auditLogs : auditLogs.body.auditLogs
  };
}

export async function getApiJson<T>(
  path: string,
  fallback: T
): Promise<{ ok: boolean; status: number; body: T }> {
  try {
    const response = await fetch(`${apiUrl()}${path}`, {
      cache: "no-store"
    });

    return {
      ok: response.ok,
      status: response.status,
      body: response.ok ? ((await response.json()) as T) : fallback
    };
  } catch {
    return {
      ok: false,
      status: 503,
      body: fallback
    };
  }
}

export async function postApiJson<TBody>(
  path: string,
  body: TBody
): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const response = await fetch(`${apiUrl()}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.json()
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      body: {
        error: normalizeError(error).message
      }
    };
  }
}

export function apiUrl(): string {
  return process.env.EVOFORK_API_URL ?? defaultApiUrl;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
