import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import {
  evaluatePatchBoundary,
  evaluateSecurityPolicy,
  runEvalGate,
  type EvalInput
} from "@evofork/eval-gate";
import {
  findSurface,
  listSurfaces,
  loadManifest,
  type EvoSurface
} from "@evofork/manifest-parser";
import { generateInsightRfc } from "@evofork/insight-worker";
import { preparePullRequest } from "@evofork/patch-agent";
import { resolveVariant, type RouterBranch } from "@evofork/router";

export const moduleId = "@evofork/cli";

export type CliIO = {
  stdout: Pick<typeof console, "log">;
  stderr: Pick<typeof console, "error">;
};

const defaultManifestPath = "evo.manifest.yaml";
const valueOptionNames = new Set([
  "actor",
  "branch",
  "branch-id",
  "branches",
  "changed-file",
  "changed-files",
  "count",
  "diff",
  "file",
  "output",
  "percentage",
  "reason",
  "rfc",
  "rollout",
  "segment",
  "state",
  "status",
  "surface",
  "text",
  "user",
  "user-id"
]);

export async function runCli(
  args: string[] = process.argv.slice(2),
  io: CliIO = {
    stdout: console,
    stderr: console
  }
): Promise<number> {
  try {
    const parsedArgs = parseArgs(args);
    const [namespace, command, ...commandArgs] = parsedArgs.commandArgs;

    if (!namespace || parsedArgs.help) {
      printHelp(io);
      return 0;
    }

    if (namespace === "manifest" && command === "validate") {
      return await validateManifestCommand(parsedArgs.manifestPath, io);
    }

    if (namespace === "surface" && command === "list") {
      return await listSurfacesCommand(parsedArgs.manifestPath, io);
    }

    if (namespace === "surface" && command === "explain") {
      return await explainSurfaceCommand(parsedArgs.manifestPath, commandArgs[0], io);
    }

    if (namespace === "insight" && command === "generate") {
      return await generateInsightCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "patch" && command === "create-pr") {
      return await createPrCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "demo" && command === "seed") {
      return await demoSeedCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "route" && command === "test") {
      return await routeTestCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "branch" && command === "list") {
      return await branchListCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "approve") {
      return await branchApproveCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "rollout") {
      return await branchRolloutCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "revert") {
      return await branchRevertCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "sunset") {
      return await branchSunsetCommand(commandArgs, io);
    }

    if (namespace === "eval" && command === "patch-boundary") {
      return await evalPatchBoundaryCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "eval" && command === "security") {
      return await evalSecurityCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "eval" && command === "report") {
      return await evalReportCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    io.stderr.error(`Unknown command: ${parsedArgs.commandArgs.join(" ")}`);
    printHelp(io);
    return 1;
  } catch (error) {
    io.stderr.error(formatError(error));
    return 1;
  }
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
}

if (isDirectRun()) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

type ParsedArgs = {
  commandArgs: string[];
  manifestPath: string;
  help: boolean;
};

function parseArgs(args: string[]): ParsedArgs {
  const commandArgs: string[] = [];
  let manifestPath = defaultManifestPath;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--manifest" || arg === "-m") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`${arg} requires a path`);
      }

      manifestPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--manifest=")) {
      const value = arg.slice("--manifest=".length);

      if (!value) {
        throw new Error("--manifest requires a path");
      }

      manifestPath = value;
      continue;
    }

    commandArgs.push(arg);
  }

  return {
    commandArgs,
    manifestPath,
    help
  };
}

function printHelp(io: CliIO): void {
  io.stdout.log("EvoFork CLI");
  io.stdout.log("");
  io.stdout.log("Usage:");
  io.stdout.log("  evo manifest validate [--manifest <path>]");
  io.stdout.log("  evo surface list [--manifest <path>]");
  io.stdout.log("  evo surface explain <surfaceId> [--manifest <path>]");
  io.stdout.log("  evo insight generate --surface <surfaceId> [--text <feedback>] [--manifest <path>]");
  io.stdout.log("  evo patch create-pr --rfc <rfcId> --surface <surfaceId> [--manifest <path>]");
  io.stdout.log("  evo demo seed [--surface <surfaceId>] [--count <n>] [--output <path>] [--json]");
  io.stdout.log("  evo route test <surfaceId> --user <userId> [--segment <key=value>] [--rollout <0-100>] [--json]");
  io.stdout.log("  evo branch list [--state <path>] [--surface <surfaceId>] [--status <status>] [--json]");
  io.stdout.log("  evo branch approve <branchId> [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo branch rollout <branchId> --percentage <0-100> [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo branch revert <branchId> --reason <reason> [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo branch sunset <branchId> [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo eval patch-boundary [--surface <surfaceId>] [--changed-file <path>] [--diff <path>]");
  io.stdout.log("  evo eval security [--changed-file <path>] [--diff <path>]");
  io.stdout.log("  evo eval report [--surface <surfaceId>] [--changed-file <path>] [--diff <path>]");
}

async function validateManifestCommand(manifestPath: string, io: CliIO): Promise<number> {
  const manifest = await loadManifest(manifestPath);

  io.stdout.log(`Manifest valid: ${manifestPath}`);
  io.stdout.log(`App: ${manifest.app.id}`);
  io.stdout.log(`Surfaces: ${manifest.surfaces.length}`);

  return 0;
}

async function listSurfacesCommand(manifestPath: string, io: CliIO): Promise<number> {
  const manifest = await loadManifest(manifestPath);

  for (const surface of listSurfaces(manifest)) {
    io.stdout.log(`${surface.id}\t${surface.type}\t${surface.path}`);
  }

  return 0;
}

async function explainSurfaceCommand(
  manifestPath: string,
  surfaceId: string | undefined,
  io: CliIO
): Promise<number> {
  if (!surfaceId) {
    io.stderr.error("Missing required surfaceId");
    return 1;
  }

  const manifest = await loadManifest(manifestPath);
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    io.stderr.error(`Surface not found: ${surfaceId}`);
    return 1;
  }

  printSurface(surface, io);
  return 0;
}

function printSurface(surface: EvoSurface, io: CliIO): void {
  io.stdout.log(`Surface: ${surface.id}`);
  io.stdout.log(`Type: ${surface.type}`);
  io.stdout.log(`Path: ${surface.path}`);
  io.stdout.log(`Owner: ${surface.owner}`);
  io.stdout.log(`Allowed changes: ${surface.allowed_changes.join(", ")}`);
  io.stdout.log(`Forbidden changes: ${surface.forbidden_changes.join(", ")}`);

  if (surface.target_metrics) {
    io.stdout.log(`Primary metric: ${surface.target_metrics.primary}`);
    io.stdout.log(`Guardrail metrics: ${surface.target_metrics.guardrails.join(", ")}`);
  }

  if (surface.tests?.length) {
    io.stdout.log(`Tests: ${surface.tests.join(" | ")}`);
  }

  if (surface.rollout) {
    io.stdout.log(
      `Rollout: max ${surface.rollout.max_auto_percentage}%, human approval ${String(
        surface.rollout.require_human_approval
      )}`
    );
  }
}

async function generateInsightCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const surfaceId = readOption(args, "surface");

  if (!surfaceId) {
    io.stderr.error("Missing required --surface <surfaceId>");
    return 1;
  }

  const manifest = await loadManifest(manifestPath);
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    io.stderr.error(`Surface not found: ${surfaceId}`);
    return 1;
  }

  const text = readOption(args, "text") ?? "I do not understand the difference between Basic and Pro.";
  const rfc = await generateInsightRfc({
    appId: manifest.app.id,
    surface,
    signals: [
      {
        id: "cli_signal_001",
        appId: manifest.app.id,
        surfaceId,
        source: "cli",
        signalType: "confusion",
        text,
        evidenceCount: 1,
        segmentHints: {},
        piiRemoved: true,
        llmEligible: true,
        createdAt: new Date().toISOString()
      }
    ]
  });

  io.stdout.log(JSON.stringify(rfc, null, 2));
  return 0;
}

async function createPrCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const rfcId = readOption(args, "rfc");
  const surfaceId = readOption(args, "surface");

  if (!rfcId) {
    io.stderr.error("Missing required --rfc <rfcId>");
    return 1;
  }

  if (!surfaceId) {
    io.stderr.error("Missing required --surface <surfaceId>");
    return 1;
  }

  const manifest = await loadManifest(manifestPath);
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    io.stderr.error(`Surface not found: ${surfaceId}`);
    return 1;
  }

  const rfc = await generateInsightRfc({
    appId: manifest.app.id,
    surface,
    signals: []
  });
  const prepared = preparePullRequest({
    manifest,
    rfc: {
      ...rfc,
      rfcId
    },
    surfaceId
  });

  io.stdout.log(JSON.stringify(prepared, null, 2));
  return 0;
}

async function demoSeedCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const manifest = await loadManifest(manifestPath);
  const surfaceId = readOption(args, "surface") ?? "pricing.hero";
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    io.stderr.error(`Surface not found: ${surfaceId}`);
    return 1;
  }

  const count = parsePositiveInteger(readOption(args, "count") ?? "20", "count");
  const outputPath = readOption(args, "output") ?? ".evofork/demo-seed.json";
  const branch = createDemoBranch(manifest.app.id, surfaceId);
  const generatedAt = new Date().toISOString();
  const seed = {
    appId: manifest.app.id,
    surfaceId,
    generatedAt,
    signals: createDemoSignals(manifest.app.id, surfaceId, count),
    branches: [branch],
    auditLogs: createDemoSeedAuditLogs(branch, generatedAt)
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(`${outputPath}`, `${JSON.stringify(seed, null, 2)}\n`, "utf8");

  if (hasFlag(args, "json")) {
    io.stdout.log(JSON.stringify({ outputPath, ...seed }, null, 2));
    return 0;
  }

  io.stdout.log(`Seeded ${seed.signals.length} demo signals for ${surfaceId}`);
  io.stdout.log(`Output: ${outputPath}`);
  io.stdout.log("Next: pnpm evo insight generate --surface pricing.hero");
  return 0;
}

async function routeTestCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const [surfaceId] = args.filter((arg) => !arg.startsWith("--"));

  if (!surfaceId) {
    io.stderr.error("Missing required surfaceId");
    return 1;
  }

  const manifest = await loadManifest(manifestPath);
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    io.stderr.error(`Surface not found: ${surfaceId}`);
    return 1;
  }

  const userId = readOption(args, "user") ?? readOption(args, "user-id") ?? "user_123";
  const segmentHints = readSegmentOptions(args);
  const rolloutPercentage = parseRolloutPercentage(readOption(args, "rollout") ?? "100");
  const branchName = readOption(args, "branch") ?? `${surfaceId}.new-user-clarity.v1`;
  const branch = createRouteTestBranch({
    appId: manifest.app.id,
    surfaceId,
    branchName,
    branchId: readOption(args, "branch-id") ?? "br_cli_route_test",
    rolloutPercentage,
    targetSegments: segmentHints
  });
  const branches =
    (await readRouteBranches(readOption(args, "branches") ?? ".evofork/demo-seed.json")) ?? [
      branch
    ];
  const result = resolveVariant(
    {
      appId: manifest.app.id,
      surfaceId,
      userId,
      segmentHints,
      personalizationOptOut: hasFlag(args, "opt-out")
    },
    branches
  );

  if (hasFlag(args, "json")) {
    io.stdout.log(JSON.stringify(result, null, 2));
    return 0;
  }

  io.stdout.log(`Matched branch: ${result.variant}`);
  io.stdout.log(`Reason: ${result.reason}`);
  io.stdout.log(`Sticky: ${String(result.sticky)}`);
  io.stdout.log(`Surface: ${result.surfaceId}`);
  return 0;
}

type LocalBranchStatus = "draft" | "canary" | "active" | "reverted" | "sunset";

type LocalBranchRecord = RouterBranch & {
  status: LocalBranchStatus;
  approvedBy?: string;
  revertReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LocalAuditLog = {
  id: string;
  appId: string;
  actor: string;
  event: string;
  resourceType: "branch";
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type LocalBranchState = {
  path: string;
  data: Record<string, unknown>;
  branches: LocalBranchRecord[];
  auditLogs: LocalAuditLog[];
};

async function branchListCommand(args: string[], io: CliIO): Promise<number> {
  const state = await readLocalBranchState(readBranchStatePath(args));
  const surfaceId = readOption(args, "surface");
  const status = readOption(args, "status");
  const branches = state.branches
    .filter((branch) => !surfaceId || branch.surfaceId === surfaceId)
    .filter((branch) => !status || branch.status === status);

  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          statePath: state.path,
          branches,
          auditLogs: state.auditLogs
        },
        null,
        2
      )
    );
    return 0;
  }

  if (branches.length === 0) {
    io.stdout.log(`No local branches found in ${state.path}`);
    return 0;
  }

  for (const branch of branches) {
    io.stdout.log(
      `${branch.id}\t${branch.surfaceId}\t${branch.status}\t${branch.rolloutPercentage}%\t${branch.branchName}`
    );
  }

  return 0;
}

async function branchApproveCommand(args: string[], io: CliIO): Promise<number> {
  return await mutateLocalBranchCommand(args, io, "branch_approved", (branch, actor, now) => {
    requireLocalBranchStatus(branch, ["draft"], "approve");

    branch.status = "canary";
    branch.approvedBy = actor;
    branch.updatedAt = now;

    return {
      approvedBy: actor,
      status: branch.status
    };
  });
}

async function branchRolloutCommand(args: string[], io: CliIO): Promise<number> {
  const percentageOption = readOption(args, "percentage") ?? readOption(args, "rollout");

  if (!percentageOption) {
    throw new Error("--percentage is required");
  }

  const percentage = parseRolloutPercentage(percentageOption);

  return await mutateLocalBranchCommand(args, io, "branch_rollout_changed", (branch, _actor, now) => {
    requireLocalBranchStatus(branch, ["canary", "active"], "rollout");

    branch.rolloutPercentage = percentage;
    branch.status = percentage >= 100 ? "active" : "canary";
    branch.updatedAt = now;

    return {
      rolloutPercentage: percentage,
      status: branch.status
    };
  });
}

async function branchRevertCommand(args: string[], io: CliIO): Promise<number> {
  const reason = readOption(args, "reason");

  if (!reason) {
    throw new Error("--reason is required");
  }

  return await mutateLocalBranchCommand(args, io, "branch_reverted", (branch, _actor, now) => {
    requireLocalBranchStatus(branch, ["draft", "canary", "active"], "revert");

    branch.status = "reverted";
    branch.rolloutPercentage = 0;
    branch.revertReason = reason;
    branch.updatedAt = now;

    return {
      reason,
      status: branch.status
    };
  });
}

async function branchSunsetCommand(args: string[], io: CliIO): Promise<number> {
  return await mutateLocalBranchCommand(args, io, "branch_sunset", (branch, _actor, now) => {
    requireLocalBranchStatus(branch, ["canary", "active", "reverted"], "sunset");

    branch.status = "sunset";
    branch.rolloutPercentage = 0;
    branch.updatedAt = now;

    return {
      status: branch.status
    };
  });
}

async function mutateLocalBranchCommand(
  args: string[],
  io: CliIO,
  event: string,
  mutate: (
    branch: LocalBranchRecord,
    actor: string,
    now: string
  ) => Record<string, unknown>
): Promise<number> {
  const branchId = readPositionalArgs(args)[0];

  if (!branchId) {
    throw new Error("Missing required branchId");
  }

  const state = await readLocalBranchState(readBranchStatePath(args));
  const branch = state.branches.find((candidate) => candidate.id === branchId);

  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  const actor = readOption(args, "actor") ?? "local-maintainer";
  const now = new Date().toISOString();
  const payload = mutate(branch, actor, now);
  const auditLog = appendLocalAuditLog(state, branch, actor, event, payload, now);

  await writeLocalBranchState(state);

  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          statePath: state.path,
          branch,
          auditLog
        },
        null,
        2
      )
    );
    return 0;
  }

  io.stdout.log(`Branch ${branch.id} updated`);
  io.stdout.log(`Status: ${branch.status}`);
  io.stdout.log(`Rollout: ${branch.rolloutPercentage}%`);
  io.stdout.log(`Audit: ${auditLog.event}`);
  io.stdout.log(`State: ${state.path}`);
  return 0;
}

function createRouteTestBranch(input: {
  appId: string;
  surfaceId: string;
  branchName: string;
  branchId: string;
  rolloutPercentage: number;
  targetSegments: Record<string, string | number | boolean>;
}): RouterBranch {
  return {
    id: input.branchId,
    appId: input.appId,
    surfaceId: input.surfaceId,
    branchName: input.branchName,
    status: "active",
    targetSegments: input.targetSegments,
    rolloutPercentage: input.rolloutPercentage,
    priority: 10
  };
}

async function readRouteBranches(path: string): Promise<RouterBranch[] | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    const candidates = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.branches)
        ? parsed.branches
        : undefined;

    if (!candidates) {
      return undefined;
    }

    return candidates.flatMap((candidate): RouterBranch[] =>
      isRouterBranch(candidate) ? [candidate] : []
    );
  } catch {
    return undefined;
  }
}

function createDemoBranch(appId: string, surfaceId: string): RouterBranch {
  return {
    id: "br_demo_seed",
    appId,
    surfaceId,
    branchName: `${surfaceId}.new-user-clarity.v1`,
    status: "active",
    targetSegments: {
      lifecycle_stage: "new_user"
    },
    rolloutPercentage: 100,
    priority: 10
  };
}

function createDemoSeedAuditLogs(branch: RouterBranch, createdAt: string): LocalAuditLog[] {
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

async function readLocalBranchState(path: string): Promise<LocalBranchState> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Local branch state not found or invalid: ${path}. Run pnpm evo demo seed first. ${formatError(
        error
      )}`
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(`Local branch state must be a JSON object: ${path}`);
  }

  const branches = Array.isArray(parsed.branches)
    ? parsed.branches.flatMap((branch): LocalBranchRecord[] =>
        isLocalBranchRecord(branch) ? [branch] : []
      )
    : [];
  const auditLogs = Array.isArray(parsed.auditLogs)
    ? parsed.auditLogs.flatMap((auditLog): LocalAuditLog[] =>
        isLocalAuditLog(auditLog) ? [auditLog] : []
      )
    : [];

  return {
    path,
    data: parsed,
    branches,
    auditLogs
  };
}

async function writeLocalBranchState(state: LocalBranchState): Promise<void> {
  await mkdir(dirname(state.path), { recursive: true });
  await writeFile(
    state.path,
    `${JSON.stringify(
      {
        ...state.data,
        branches: state.branches,
        auditLogs: state.auditLogs
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function appendLocalAuditLog(
  state: LocalBranchState,
  branch: LocalBranchRecord,
  actor: string,
  event: string,
  payload: Record<string, unknown>,
  createdAt: string
): LocalAuditLog {
  const auditLog: LocalAuditLog = {
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
  return auditLog;
}

function nextAuditId(auditLogs: LocalAuditLog[]): string {
  let counter = auditLogs.length + 1;
  let id = `audit_local_${String(counter).padStart(3, "0")}`;
  const existing = new Set(auditLogs.map((auditLog) => auditLog.id));

  while (existing.has(id)) {
    counter += 1;
    id = `audit_local_${String(counter).padStart(3, "0")}`;
  }

  return id;
}

function requireLocalBranchStatus(
  branch: LocalBranchRecord,
  allowed: LocalBranchStatus[],
  action: string
): void {
  if (!allowed.includes(branch.status)) {
    throw new Error(`Cannot ${action} branch ${branch.id} from status ${branch.status}`);
  }
}

function readBranchStatePath(args: string[]): string {
  return readOption(args, "state") ?? readOption(args, "file") ?? ".evofork/demo-seed.json";
}

async function evalPatchBoundaryCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const input = await readEvalInput(manifestPath, args);
  const result = evaluatePatchBoundary(input);

  io.stdout.log(JSON.stringify(result, null, 2));
  return result.passed ? 0 : 1;
}

async function evalSecurityCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const input = await readEvalInput(manifestPath, args);
  const result = evaluateSecurityPolicy(input);

  io.stdout.log(JSON.stringify(result, null, 2));
  return result.passed ? 0 : 1;
}

async function evalReportCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const input = await readEvalInput(manifestPath, args);
  const report = runEvalGate(input);

  io.stdout.log(JSON.stringify(report, null, 2));
  return report.status === "passed" ? 0 : 1;
}

async function readEvalInput(manifestPath: string, args: string[]): Promise<EvalInput> {
  const manifest = await loadManifest(manifestPath);
  const surfaceId = readOption(args, "surface");
  const diffPath = readOption(args, "diff");
  const diff = diffPath ? await readFile(diffPath, "utf8") : undefined;
  const changedFiles = readChangedFilesOption(args);

  if (!diff && changedFiles.length === 0) {
    changedFiles.push(...(await readGitChangedFiles()));
  }

  if (!diff && changedFiles.length === 0 && surfaceId) {
    const surface = findSurface(manifest, surfaceId);

    if (surface) {
      changedFiles.push(surface.path);
    }
  }

  return {
    manifest,
    surfaceId,
    changedFiles,
    diff
  };
}

function readOption(args: string[], name: string): string | undefined {
  const longName = `--${name}`;
  const withEquals = `${longName}=`;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === longName) {
      return args[index + 1];
    }

    if (arg.startsWith(withEquals)) {
      return arg.slice(withEquals.length);
    }
  }

  return undefined;
}

function readChangedFilesOption(args: string[]): string[] {
  const values = [
    ...readRepeatedOption(args, "changed-file"),
    ...readRepeatedOption(args, "changed-files")
  ];

  return values.flatMap(splitChangedFiles);
}

function readSegmentOptions(args: string[]): Record<string, string | number | boolean> {
  return Object.fromEntries(
    readRepeatedOption(args, "segment").map((segment) => {
      const separatorIndex = segment.indexOf("=");

      if (separatorIndex <= 0) {
        throw new Error(`Invalid --segment value: ${segment}. Expected key=value.`);
      }

      const key = segment.slice(0, separatorIndex).trim();
      const value = parseSegmentValue(segment.slice(separatorIndex + 1).trim());

      if (!key) {
        throw new Error(`Invalid --segment value: ${segment}. Expected key=value.`);
      }

      return [key, value] as const;
    })
  );
}

function parseSegmentValue(value: string): string | number | boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) && value.trim() !== "" ? numeric : value;
}

function hasFlag(args: string[], name: string): boolean {
  const flag = `--${name}`;

  return args.includes(flag);
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }

  return parsed;
}

function parseRolloutPercentage(value: string): number {
  const parsed = Number(value);

  if (value.trim() === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("--rollout must be an integer from 0 to 100");
  }

  return parsed;
}

function createDemoSignals(appId: string, surfaceId: string, count: number) {
  const texts = [
    "I cannot tell which plan is right for a small team.",
    "Basic and Pro sound too similar on the pricing page.",
    "I need a clearer recommendation before signing up.",
    "The primary CTA does not explain what happens next."
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: `demo_signal_${String(index + 1).padStart(3, "0")}`,
    appId,
    surfaceId,
    source: "demo_seed",
    signalType: index % 4 === 3 ? "cta_unclear" : "pricing_confusion",
    text: texts[index % texts.length],
    evidenceCount: 1,
    segmentHints: {
      lifecycle_stage: "new_user",
      company_size: index % 2 === 0 ? "1-10" : "11-50"
    },
    piiRemoved: true,
    llmEligible: true
  }));
}

function isRouterBranch(value: unknown): value is RouterBranch {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.appId === "string" &&
    typeof value.surfaceId === "string" &&
    typeof value.branchName === "string" &&
    typeof value.status === "string" &&
    isRecord(value.targetSegments) &&
    typeof value.rolloutPercentage === "number"
  );
}

const localBranchStatuses = ["draft", "canary", "active", "reverted", "sunset"] as const;

function isLocalBranchRecord(value: unknown): value is LocalBranchRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.appId === "string" &&
    typeof value.surfaceId === "string" &&
    typeof value.branchName === "string" &&
    isLocalBranchStatus(value.status) &&
    isRecord(value.targetSegments) &&
    typeof value.rolloutPercentage === "number"
  );
}

function isLocalBranchStatus(value: unknown): value is LocalBranchStatus {
  return typeof value === "string" && localBranchStatuses.includes(value as LocalBranchStatus);
}

function isLocalAuditLog(value: unknown): value is LocalAuditLog {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPositionalArgs(args: string[]): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      values.push(arg);
      continue;
    }

    const [name] = arg.slice(2).split("=");

    if (!arg.includes("=") && valueOptionNames.has(name)) {
      index += 1;
    }
  }

  return values;
}

function readRepeatedOption(args: string[], name: string): string[] {
  const values: string[] = [];
  const longName = `--${name}`;
  const withEquals = `${longName}=`;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === longName && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith(withEquals)) {
      values.push(arg.slice(withEquals.length));
    }
  }

  return values;
}

function splitChangedFiles(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

async function readGitChangedFiles(): Promise<string[]> {
  const envChangedFiles = process.env.EVOFORK_CHANGED_FILES;

  if (envChangedFiles) {
    return splitChangedFiles(envChangedFiles);
  }

  const ranges = process.env.GITHUB_BASE_REF
    ? [`origin/${process.env.GITHUB_BASE_REF}...HEAD`, "HEAD~1...HEAD"]
    : ["HEAD~1...HEAD"];

  for (const range of ranges) {
    const output = await execGit(["diff", "--name-only", "--diff-filter=ACMRTUXB", range]);
    const changedFiles = splitChangedFiles(output);

    if (changedFiles.length > 0) {
      return changedFiles;
    }
  }

  return [];
}

async function execGit(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd: process.cwd() }, (error, stdout) => {
      resolve(error ? "" : String(stdout));
    });
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
