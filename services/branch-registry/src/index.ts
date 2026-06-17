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

export interface BranchRegistry {
  list(filter?: BranchListFilter): Promise<BranchRecord[]>;
  listAuditLogs(filter?: AuditLogFilter): Promise<AuditLogRecord[]>;
  get(id: string): Promise<BranchRecord | undefined>;
  create(input: CreateBranchInput): Promise<BranchRecord>;
  approve(id: string, input?: { actor?: string; approvedBy?: string }): Promise<BranchRecord>;
  rollout(id: string, input: { percentage: number; actor?: string }): Promise<BranchRecord>;
  revert(id: string, input: { reason: string; actor?: string }): Promise<BranchRecord>;
  sunset(id: string, input?: { actor?: string }): Promise<BranchRecord>;
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

function randomId(): string {
  return `br_${Math.random().toString(36).slice(2, 10)}`;
}
