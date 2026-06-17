import type { AdminBranch, AdminSignal } from "./admin-api";

export type DemoSeedState = {
  signals: AdminSignal[];
  branches: AdminBranch[];
};

export async function readDemoSeed(path = process.env.EVOFORK_DEMO_SEED_PATH): Promise<DemoSeedState> {
  if (process.env.NODE_ENV === "production" && !path) {
    return emptySeed();
  }

  const seedPath = path ?? `${repoRoot()}/.evofork/demo-seed.json`;

  try {
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(/* turbopackIgnore: true */ seedPath, "utf8")) as unknown;

    return {
      signals: readSignals(parsed),
      branches: readBranches(parsed)
    };
  } catch {
    return emptySeed();
  }
}

function emptySeed(): DemoSeedState {
  return {
    signals: [],
    branches: []
  };
}

function repoRoot(): string {
  return process.env.EVOFORK_REPO_ROOT ?? `${process.cwd()}/../..`;
}

function readSignals(value: unknown): AdminSignal[] {
  const signals = isRecord(value) && Array.isArray(value.signals) ? value.signals : [];

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

function readBranches(value: unknown): AdminBranch[] {
  const branches = isRecord(value) && Array.isArray(value.branches) ? value.branches : [];

  return branches.flatMap((branch): AdminBranch[] => {
    if (!isRecord(branch)) {
      return [];
    }

    const id = readString(branch.id);
    const appId = readString(branch.appId);
    const surfaceId = readString(branch.surfaceId);
    const branchName = readString(branch.branchName);
    const status = readString(branch.status);
    const rolloutPercentage = readNumber(branch.rolloutPercentage);

    if (!id || !appId || !surfaceId || !branchName || !status || rolloutPercentage === undefined) {
      return [];
    }

    return [
      {
        id,
        appId,
        surfaceId,
        branchName,
        status,
        rolloutPercentage
      }
    ];
  });
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
