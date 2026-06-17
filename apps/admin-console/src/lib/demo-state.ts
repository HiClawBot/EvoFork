import { readLocalDemoState } from "@evofork/branch-registry";
import type { AdminAuditLog, AdminBranch, AdminSignal } from "./admin-api";

export type DemoSeedState = {
  signals: AdminSignal[];
  branches: AdminBranch[];
  auditLogs: AdminAuditLog[];
};

export async function readDemoSeed(path = process.env.EVOFORK_DEMO_SEED_PATH): Promise<DemoSeedState> {
  const seedPath = resolveDemoSeedPath(path);

  if (!seedPath) {
    return emptySeed();
  }

  try {
    const state = await readLocalDemoState(seedPath);

    return {
      signals: readSignals(state.signals),
      branches: state.branches.map((branch) => ({
        id: branch.id,
        appId: branch.appId,
        surfaceId: branch.surfaceId,
        branchName: branch.branchName,
        status: branch.status,
        rolloutPercentage: branch.rolloutPercentage
      })),
      auditLogs: state.auditLogs.map((auditLog) => ({
        id: auditLog.id,
        appId: auditLog.appId,
        actor: auditLog.actor,
        event: auditLog.event,
        resourceId: auditLog.resourceId
      }))
    };
  } catch {
    return emptySeed();
  }
}

export function resolveDemoSeedPath(path = process.env.EVOFORK_DEMO_SEED_PATH): string | undefined {
  if (process.env.NODE_ENV === "production" && !path) {
    return undefined;
  }

  return path ?? `${repoRoot()}/.evofork/demo-seed.json`;
}

function emptySeed(): DemoSeedState {
  return {
    signals: [],
    branches: [],
    auditLogs: []
  };
}

function repoRoot(): string {
  return process.env.EVOFORK_REPO_ROOT ?? `${process.cwd()}/../..`;
}

function readSignals(value: unknown): AdminSignal[] {
  const signals = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.signals)
      ? value.signals
      : [];

  return signals.flatMap((signal): AdminSignal[] => {
    if (!isRecord(signal)) {
      return [];
    }

    const id = readString(signal.id);
    const appId = readString(signal.appId);
    const surfaceId = readString(signal.surfaceId);
    const signalType = readString(signal.signalType);

    if (!id || !appId || !surfaceId || !signalType) {
      return [];
    }

    return [
      {
        id,
        appId,
        surfaceId,
        signalType,
        text: readString(signal.text),
        summary: readString(signal.summary)
      }
    ];
  });
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
