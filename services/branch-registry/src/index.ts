import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const serviceId = "@evofork/branch-registry";

export type BranchStatus = "draft" | "canary" | "active" | "reverted" | "sunset";

export type SegmentValue = string | number | boolean;
export type TargetSegments = Record<string, SegmentValue | SegmentValue[]>;

export type BranchRecord = {
  id: string;
  appId: string;
  surfaceId: string;
  rfcId?: string;
  branchName: string;
  baseVersion?: string;
  gitBranch?: string;
  commitHash?: string;
  prUrl?: string;
  status: BranchStatus;
  targetSegments: TargetSegments;
  rolloutPercentage: number;
  priority: number;
  evalReport?: unknown;
  createdBy: string;
  approvedBy?: string;
  revertReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogRecord = {
  id: string;
  appId: string;
  actor: string;
  event: string;
  resourceType: "branch";
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type CreateBranchInput = {
  appId: string;
  surfaceId: string;
  rfcId?: string;
  branchName: string;
  baseVersion?: string;
  gitBranch?: string;
  commitHash?: string;
  prUrl?: string;
  targetSegments?: TargetSegments;
  rolloutPercentage?: number;
  priority?: number;
  evalReport?: unknown;
  createdBy?: string;
};

export type BranchListFilter = {
  appId?: string;
  surfaceId?: string;
  statuses?: BranchStatus[];
};

export type AuditLogFilter = {
  appId?: string;
  resourceId?: string;
};

export type LocalDemoState = {
  path: string;
  data: Record<string, unknown>;
  signals: unknown[];
  branches: BranchRecord[];
  auditLogs: AuditLogRecord[];
};

export type CreateLocalBranchInput = {
  appId: string;
  surfaceId: string;
  rfcId?: string;
  branchName: string;
  branchId?: string;
  gitBranch?: string;
  targetSegments?: TargetSegments;
  priority?: number;
  evalReport?: unknown;
  actor?: string;
};

export interface BranchRegistry {
  list(filter?: BranchListFilter): Promise<BranchRecord[]>;
  listAuditLogs(filter?: AuditLogFilter): Promise<AuditLogRecord[]>;
  get(id: string): Promise<BranchRecord | undefined>;
  create(input: CreateBranchInput): Promise<BranchRecord>;
  approve(id: string, input?: { actor?: string; approvedBy?: string }): Promise<BranchRecord>;
  rollout(id: string, input: { percentage: number; actor?: string }): Promise<BranchRecord>;
  promote(id: string, input?: { actor?: string }): Promise<BranchRecord>;
  revert(id: string, input: { reason: string; actor?: string }): Promise<BranchRecord>;
  sunset(id: string, input?: { actor?: string }): Promise<BranchRecord>;
  recordAudit(
    id: string,
    input: { actor?: string; event: string; payload?: Record<string, unknown> }
  ): Promise<AuditLogRecord>;
}

export interface AuditLogRepository {
  write(record: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord>;
  list(): Promise<AuditLogRecord[]>;
}

export class BranchRegistryError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "BranchRegistryError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly records: AuditLogRecord[] = [];
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(options: { idGenerator?: () => string; clock?: () => Date } = {}) {
    this.idGenerator = options.idGenerator ?? randomId;
    this.clock = options.clock ?? (() => new Date());
  }

  async write(record: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord> {
    const created: AuditLogRecord = {
      ...record,
      id: this.idGenerator(),
      createdAt: this.clock().toISOString()
    };

    this.records.push(created);

    return { ...created, payload: { ...created.payload } };
  }

  async list(): Promise<AuditLogRecord[]> {
    return this.records.map((record) => ({ ...record, payload: { ...record.payload } }));
  }
}

export class InMemoryBranchRegistry implements BranchRegistry {
  private readonly branches = new Map<string, BranchRecord>();
  private readonly auditLog: AuditLogRepository;
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(
    options: {
      auditLog?: AuditLogRepository;
      idGenerator?: () => string;
      clock?: () => Date;
    } = {}
  ) {
    this.auditLog = options.auditLog ?? new InMemoryAuditLogRepository(options);
    this.idGenerator = options.idGenerator ?? randomId;
    this.clock = options.clock ?? (() => new Date());
  }

  async list(filter: BranchListFilter = {}): Promise<BranchRecord[]> {
    return [...this.branches.values()]
      .filter((branch) => !filter.appId || branch.appId === filter.appId)
      .filter((branch) => !filter.surfaceId || branch.surfaceId === filter.surfaceId)
      .filter((branch) => !filter.statuses || filter.statuses.includes(branch.status))
      .map(cloneBranch);
  }

  async listAuditLogs(filter: AuditLogFilter = {}): Promise<AuditLogRecord[]> {
    const records = await this.auditLog.list();

    return records
      .filter((record) => !filter.appId || record.appId === filter.appId)
      .filter((record) => !filter.resourceId || record.resourceId === filter.resourceId);
  }

  async get(id: string): Promise<BranchRecord | undefined> {
    const branch = this.branches.get(id);

    return branch ? cloneBranch(branch) : undefined;
  }

  async create(input: CreateBranchInput): Promise<BranchRecord> {
    validateRolloutPercentage(input.rolloutPercentage ?? 0);

    const now = this.clock().toISOString();
    const branch: BranchRecord = {
      id: this.idGenerator(),
      appId: input.appId,
      surfaceId: input.surfaceId,
      rfcId: input.rfcId,
      branchName: input.branchName,
      baseVersion: input.baseVersion,
      gitBranch: input.gitBranch,
      commitHash: input.commitHash,
      prUrl: input.prUrl,
      status: "draft",
      targetSegments: cloneSegments(input.targetSegments ?? {}),
      rolloutPercentage: input.rolloutPercentage ?? 0,
      priority: input.priority ?? 0,
      evalReport: input.evalReport,
      createdBy: input.createdBy ?? "system",
      createdAt: now,
      updatedAt: now
    };

    this.branches.set(branch.id, branch);
    await this.writeAudit(branch, input.createdBy ?? "system", "branch_created", {
      status: branch.status
    });

    return cloneBranch(branch);
  }

  async approve(
    id: string,
    input: { actor?: string; approvedBy?: string } = {}
  ): Promise<BranchRecord> {
    const branch = this.requireBranch(id);
    requireStatus(branch, ["draft"], "approve");

    branch.status = "canary";
    branch.approvedBy = input.approvedBy ?? input.actor ?? "human";
    branch.updatedAt = this.clock().toISOString();

    await this.writeAudit(branch, input.actor ?? branch.approvedBy, "branch_approved", {
      approvedBy: branch.approvedBy
    });

    return cloneBranch(branch);
  }

  async rollout(id: string, input: { percentage: number; actor?: string }): Promise<BranchRecord> {
    validateRolloutPercentage(input.percentage);

    const branch = this.requireBranch(id);
    requireStatus(branch, ["canary", "active"], "rollout");

    branch.rolloutPercentage = input.percentage;
    branch.status = input.percentage >= 100 ? "active" : "canary";
    branch.updatedAt = this.clock().toISOString();

    await this.writeAudit(branch, input.actor ?? "system", "branch_rollout_changed", {
      rolloutPercentage: branch.rolloutPercentage,
      status: branch.status
    });

    return cloneBranch(branch);
  }

  async promote(id: string, input: { actor?: string } = {}): Promise<BranchRecord> {
    const branch = this.requireBranch(id);
    requireStatus(branch, ["canary"], "promote");

    branch.rolloutPercentage = 100;
    branch.status = "active";
    branch.updatedAt = this.clock().toISOString();

    await this.writeAudit(branch, input.actor ?? "system", "branch_promoted", {
      rolloutPercentage: branch.rolloutPercentage,
      status: branch.status
    });

    return cloneBranch(branch);
  }

  async revert(id: string, input: { reason: string; actor?: string }): Promise<BranchRecord> {
    const branch = this.requireBranch(id);
    requireStatus(branch, ["draft", "canary", "active"], "revert");

    branch.status = "reverted";
    branch.rolloutPercentage = 0;
    branch.revertReason = input.reason;
    branch.updatedAt = this.clock().toISOString();

    await this.writeAudit(branch, input.actor ?? "system", "branch_reverted", {
      reason: input.reason
    });

    return cloneBranch(branch);
  }

  async recordAudit(
    id: string,
    input: { actor?: string; event: string; payload?: Record<string, unknown> }
  ): Promise<AuditLogRecord> {
    const branch = this.requireBranch(id);

    return await this.auditLog.write({
      appId: branch.appId,
      actor: input.actor ?? "system",
      event: input.event,
      resourceType: "branch",
      resourceId: branch.id,
      payload: input.payload ?? {}
    });
  }

  async sunset(id: string, input: { actor?: string } = {}): Promise<BranchRecord> {
    const branch = this.requireBranch(id);
    requireStatus(branch, ["canary", "active", "reverted"], "sunset");

    branch.status = "sunset";
    branch.rolloutPercentage = 0;
    branch.updatedAt = this.clock().toISOString();

    await this.writeAudit(branch, input.actor ?? "system", "branch_sunset", {});

    return cloneBranch(branch);
  }

  private requireBranch(id: string): BranchRecord {
    const branch = this.branches.get(id);

    if (!branch) {
      throw new BranchRegistryError("branch_not_found", `Branch not found: ${id}`, 404);
    }

    return branch;
  }

  private async writeAudit(
    branch: BranchRecord,
    actor: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.auditLog.write({
      appId: branch.appId,
      actor,
      event,
      resourceType: "branch",
      resourceId: branch.id,
      payload
    });
  }
}

export const defaultLocalDemoStatePath = ".evofork/demo-seed.json";

export function emptyLocalDemoState(
  path = defaultLocalDemoStatePath,
  data: Record<string, unknown> = {}
): LocalDemoState {
  return {
    path,
    data,
    signals: Array.isArray(data.signals) ? data.signals : [],
    branches: [],
    auditLogs: []
  };
}

export async function readLocalDemoState(
  path = defaultLocalDemoStatePath
): Promise<LocalDemoState> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(`Local demo state must be a JSON object: ${path}`);
  }

  return parseLocalDemoState(path, parsed);
}

export async function readOrCreateLocalDemoState(
  path = defaultLocalDemoStatePath,
  data: Record<string, unknown> = {}
): Promise<LocalDemoState> {
  try {
    return await readLocalDemoState(path);
  } catch {
    return emptyLocalDemoState(path, {
      generatedAt: new Date().toISOString(),
      ...data
    });
  }
}

export async function writeLocalDemoState(state: LocalDemoState): Promise<void> {
  await mkdir(dirname(state.path), { recursive: true });
  await writeFile(
    state.path,
    `${JSON.stringify(
      {
        ...state.data,
        signals: state.signals,
        branches: state.branches,
        auditLogs: state.auditLogs
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

export function parseLocalDemoState(
  path: string,
  value: Record<string, unknown>
): LocalDemoState {
  return {
    path,
    data: value,
    signals: Array.isArray(value.signals) ? value.signals : [],
    branches: Array.isArray(value.branches)
      ? value.branches.flatMap((branch): BranchRecord[] => normalizeLocalBranchRecord(branch))
      : [],
    auditLogs: Array.isArray(value.auditLogs)
      ? value.auditLogs.flatMap((auditLog): AuditLogRecord[] =>
          isLocalAuditLogRecord(auditLog) ? [auditLog] : []
        )
      : []
  };
}

export function createLocalBranch(
  state: LocalDemoState,
  input: CreateLocalBranchInput,
  now = new Date().toISOString()
): { branch: BranchRecord; auditLog: AuditLogRecord } {
  const id = input.branchId ?? nextBranchId(state.branches);

  if (state.branches.some((branch) => branch.id === id)) {
    throw new BranchRegistryError("branch_already_exists", `Branch already exists: ${id}`);
  }

  const branch: BranchRecord = {
    id,
    appId: input.appId,
    surfaceId: input.surfaceId,
    rfcId: input.rfcId,
    branchName: input.branchName,
    gitBranch: input.gitBranch,
    status: "draft",
    targetSegments: cloneSegments(input.targetSegments ?? {}),
    rolloutPercentage: 0,
    priority: input.priority ?? 10,
    evalReport: input.evalReport,
    createdBy: input.actor ?? "local-maintainer",
    createdAt: now,
    updatedAt: now
  };

  state.branches.push(branch);

  return {
    branch: cloneBranch(branch),
    auditLog: appendLocalAuditLog(state, branch, input.actor ?? branch.createdBy, "branch_created", {
      status: branch.status
    }, now)
  };
}

export function approveLocalBranch(
  state: LocalDemoState,
  id: string,
  actor = "local-maintainer",
  now = new Date().toISOString()
): { branch: BranchRecord; auditLog: AuditLogRecord } {
  const branch = requireLocalBranch(state, id);
  requireStatus(branch, ["draft"], "approve");

  branch.status = "canary";
  branch.approvedBy = actor;
  branch.updatedAt = now;

  return {
    branch: cloneBranch(branch),
    auditLog: appendLocalAuditLog(state, branch, actor, "branch_approved", {
      approvedBy: actor,
      status: branch.status
    }, now)
  };
}

export function rolloutLocalBranch(
  state: LocalDemoState,
  id: string,
  percentage: number,
  actor = "local-maintainer",
  now = new Date().toISOString()
): { branch: BranchRecord; auditLog: AuditLogRecord } {
  validateRolloutPercentage(percentage);

  const branch = requireLocalBranch(state, id);
  requireStatus(branch, ["canary", "active"], "rollout");

  branch.rolloutPercentage = percentage;
  branch.status = percentage >= 100 ? "active" : "canary";
  branch.updatedAt = now;

  return {
    branch: cloneBranch(branch),
    auditLog: appendLocalAuditLog(state, branch, actor, "branch_rollout_changed", {
      rolloutPercentage: percentage,
      status: branch.status
    }, now)
  };
}

export function promoteLocalBranch(
  state: LocalDemoState,
  id: string,
  actor = "local-maintainer",
  now = new Date().toISOString()
): { branch: BranchRecord; auditLog: AuditLogRecord } {
  const branch = requireLocalBranch(state, id);
  requireStatus(branch, ["canary"], "promote");

  branch.status = "active";
  branch.rolloutPercentage = 100;
  branch.updatedAt = now;

  return {
    branch: cloneBranch(branch),
    auditLog: appendLocalAuditLog(state, branch, actor, "branch_promoted", {
      rolloutPercentage: branch.rolloutPercentage,
      status: branch.status
    }, now)
  };
}

export function recordLocalBranchAuditLog(
  state: LocalDemoState,
  id: string,
  actor: string,
  event: string,
  payload: Record<string, unknown>,
  now = new Date().toISOString()
): AuditLogRecord {
  const branch = requireLocalBranch(state, id);

  return appendLocalAuditLog(state, branch, actor, event, payload, now);
}

export function revertLocalBranch(
  state: LocalDemoState,
  id: string,
  reason: string,
  actor = "local-maintainer",
  now = new Date().toISOString()
): { branch: BranchRecord; auditLog: AuditLogRecord } {
  if (!reason) {
    throw new BranchRegistryError("missing_revert_reason", "Revert reason is required");
  }

  const branch = requireLocalBranch(state, id);
  requireStatus(branch, ["draft", "canary", "active"], "revert");

  branch.status = "reverted";
  branch.rolloutPercentage = 0;
  branch.revertReason = reason;
  branch.updatedAt = now;

  return {
    branch: cloneBranch(branch),
    auditLog: appendLocalAuditLog(state, branch, actor, "branch_reverted", {
      reason,
      status: branch.status
    }, now)
  };
}

export function sunsetLocalBranch(
  state: LocalDemoState,
  id: string,
  actor = "local-maintainer",
  now = new Date().toISOString()
): { branch: BranchRecord; auditLog: AuditLogRecord } {
  const branch = requireLocalBranch(state, id);
  requireStatus(branch, ["canary", "active", "reverted"], "sunset");

  branch.status = "sunset";
  branch.rolloutPercentage = 0;
  branch.updatedAt = now;

  return {
    branch: cloneBranch(branch),
    auditLog: appendLocalAuditLog(state, branch, actor, "branch_sunset", {
      status: branch.status
    }, now)
  };
}

export function createDemoSeedAuditLogs(
  branch: Pick<BranchRecord, "appId" | "id" | "rolloutPercentage" | "status">,
  createdAt: string
): AuditLogRecord[] {
  return [
    {
      id: "audit_demo_seed_created",
      appId: branch.appId,
      actor: "demo_seed",
      event: "branch_created",
      resourceType: "branch",
      resourceId: branch.id,
      payload: {
        status: "draft"
      },
      createdAt
    },
    {
      id: "audit_demo_seed_approved",
      appId: branch.appId,
      actor: "demo_seed",
      event: "branch_approved",
      resourceType: "branch",
      resourceId: branch.id,
      payload: {
        approvedBy: "demo_seed"
      },
      createdAt
    },
    {
      id: "audit_demo_seed_rollout",
      appId: branch.appId,
      actor: "demo_seed",
      event: "branch_rollout_changed",
      resourceType: "branch",
      resourceId: branch.id,
      payload: {
        rolloutPercentage: branch.rolloutPercentage,
        status: branch.status
      },
      createdAt
    }
  ];
}

function requireLocalBranch(state: LocalDemoState, id: string): BranchRecord {
  const branch = state.branches.find((candidate) => candidate.id === id);

  if (!branch) {
    throw new BranchRegistryError("branch_not_found", `Branch not found: ${id}`, 404);
  }

  return branch;
}

function appendLocalAuditLog(
  state: LocalDemoState,
  branch: BranchRecord,
  actor: string,
  event: string,
  payload: Record<string, unknown>,
  createdAt: string
): AuditLogRecord {
  const auditLog: AuditLogRecord = {
    id: nextAuditId(state.auditLogs),
    appId: branch.appId,
    actor,
    event,
    resourceType: "branch",
    resourceId: branch.id,
    payload,
    createdAt
  };

  state.auditLogs.push(auditLog);
  return { ...auditLog, payload: { ...auditLog.payload } };
}

function nextBranchId(branches: BranchRecord[]): string {
  return nextLocalId(
    "br_local",
    new Set(branches.map((branch) => branch.id))
  );
}

function nextAuditId(auditLogs: AuditLogRecord[]): string {
  return nextLocalId(
    "audit_local",
    new Set(auditLogs.map((auditLog) => auditLog.id))
  );
}

function nextLocalId(prefix: string, existing: Set<string>): string {
  let counter = existing.size + 1;
  let id = `${prefix}_${String(counter).padStart(3, "0")}`;

  while (existing.has(id)) {
    counter += 1;
    id = `${prefix}_${String(counter).padStart(3, "0")}`;
  }

  return id;
}

function requireStatus(branch: BranchRecord, allowed: BranchStatus[], action: string): void {
  if (!allowed.includes(branch.status)) {
    throw new BranchRegistryError(
      "invalid_branch_transition",
      `Cannot ${action} branch ${branch.id} from status ${branch.status}`
    );
  }
}

function validateRolloutPercentage(percentage: number): void {
  if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
    throw new BranchRegistryError(
      "invalid_rollout_percentage",
      "Rollout percentage must be an integer between 0 and 100"
    );
  }
}

function cloneBranch(branch: BranchRecord): BranchRecord {
  return {
    ...branch,
    targetSegments: cloneSegments(branch.targetSegments)
  };
}

function cloneSegments(segments: TargetSegments): TargetSegments {
  return Object.fromEntries(
    Object.entries(segments).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value
    ])
  );
}

function normalizeLocalBranchRecord(value: unknown): BranchRecord[] {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.appId !== "string" ||
    typeof value.surfaceId !== "string" ||
    typeof value.branchName !== "string" ||
    !isBranchStatus(value.status) ||
    !isRecord(value.targetSegments) ||
    typeof value.rolloutPercentage !== "number"
  ) {
    return [];
  }

  const createdAt = readString(value.createdAt) ?? new Date(0).toISOString();

  return [
    {
      id: value.id,
      appId: value.appId,
      surfaceId: value.surfaceId,
      rfcId: readString(value.rfcId),
      branchName: value.branchName,
      baseVersion: readString(value.baseVersion),
      gitBranch: readString(value.gitBranch),
      commitHash: readString(value.commitHash),
      prUrl: readString(value.prUrl),
      status: value.status,
      targetSegments: cloneSegments(value.targetSegments as TargetSegments),
      rolloutPercentage: value.rolloutPercentage,
      priority: readNumber(value.priority) ?? 0,
      evalReport: value.evalReport,
      createdBy: readString(value.createdBy) ?? "local-state",
      approvedBy: readString(value.approvedBy),
      revertReason: readString(value.revertReason),
      createdAt,
      updatedAt: readString(value.updatedAt) ?? createdAt
    }
  ];
}

function isLocalAuditLogRecord(value: unknown): value is AuditLogRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.appId === "string" &&
    typeof value.actor === "string" &&
    typeof value.event === "string" &&
    value.resourceType === "branch" &&
    typeof value.resourceId === "string" &&
    isRecord(value.payload) &&
    typeof value.createdAt === "string"
  );
}

function isBranchStatus(value: unknown): value is BranchStatus {
  return (
    value === "draft" ||
    value === "canary" ||
    value === "active" ||
    value === "reverted" ||
    value === "sunset"
  );
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

function randomId(): string {
  return `br_${Math.random().toString(36).slice(2, 10)}`;
}
