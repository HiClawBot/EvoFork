import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  approveLocalBranch,
  createDemoSeedAuditLogs,
  createLocalBranch,
  defaultLocalDemoStatePath,
  readLocalDemoState,
  readOrCreateLocalDemoState,
  promoteLocalBranch,
  recordLocalBranchAuditLog,
  revertLocalBranch,
  rolloutLocalBranch,
  sunsetLocalBranch,
  writeLocalDemoState,
  type AuditLogRecord,
  type BranchRecord,
  type LocalDemoState
} from "@evofork/branch-registry";
import {
  createEvalInputFromFixture,
  evaluatePatchBoundary,
  evaluateSecurityPolicy,
  findSafetyFixture,
  listSafetyFixtures,
  runEvalGate,
  type EvalInput,
  type EvalReport,
  type SafetyFixture
} from "@evofork/eval-gate";
import {
  listMigrationFiles,
  type MigrationFile
} from "@evofork/db";
import {
  findSurface,
  listSurfaces,
  loadManifest,
  type EvoSurface
} from "@evofork/manifest-parser";
import { generateInsightRfc } from "@evofork/insight-worker";
import { preparePullRequest } from "@evofork/patch-agent";
import { evaluatePolicy, type PolicyDecision } from "@evofork/policy-engine";
import { resolveVariant, type RouterBranch } from "@evofork/router";
import {
  analyzeCanary,
  buildCanaryInputFromMetricEvents,
  getCanaryFixture,
  isCanaryFixtureId,
  listCanaryFixtures,
  type CanaryMetricEventInput,
  type CanaryObservationInput
} from "@evofork/rollout-observer";

export const moduleId = "@evofork/cli";

export type CliIO = {
  stdout: Pick<typeof console, "log">;
  stderr: Pick<typeof console, "error">;
};

const defaultManifestPath = "evo.manifest.yaml";
const valueOptionNames = new Set([
  "actor",
  "allow-risk",
  "branch",
  "branch-id",
  "branches",
  "changed-file",
  "changed-files",
  "change",
  "count",
  "database-url",
  "diff",
  "endpoint",
  "events",
  "event",
  "file",
  "fixture",
  "input",
  "min-sample",
  "migrations-dir",
  "observed-at",
  "output",
  "percentage",
  "priority",
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

    if (namespace === "policy" && command === "check") {
      return await policyCheckCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "demo" && command === "seed") {
      return await demoSeedCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "route" && command === "test") {
      return await routeTestCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "observe" && command === "canary") {
      return await observeCanaryCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "observe" && command === "input") {
      return await observeInputCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "observe" && command === "fixtures") {
      return observeFixturesCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "list") {
      return await branchListCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "create") {
      return await branchCreateCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "branch" && command === "approve") {
      return await branchApproveCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "rollout") {
      return await branchRolloutCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "branch" && command === "promote") {
      return await branchPromoteCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "branch" && command === "revert") {
      return await branchRevertCommand(commandArgs, io);
    }

    if (namespace === "branch" && command === "sunset") {
      return await branchSunsetCommand(parsedArgs.manifestPath, commandArgs, io);
    }

    if (namespace === "db" && command === "status") {
      return await dbStatusCommand(commandArgs, io);
    }

    if (namespace === "db" && command === "migrate") {
      return await dbMigrateCommand(commandArgs, io);
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

    if (namespace === "eval" && command === "fixtures") {
      return evalFixturesCommand(commandArgs, io);
    }

    if (namespace === "eval" && command === "fixture") {
      return await evalFixtureCommand(parsedArgs.manifestPath, commandArgs, io);
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
  io.stdout.log("  evo policy check --surface <surfaceId> [--change <category>] [--rollout <0-100>] [--approved] [--json]");
  io.stdout.log("  evo demo seed [--surface <surfaceId>] [--count <n>] [--output <path>] [--json]");
  io.stdout.log("  evo route test <surfaceId> --user <userId> [--segment <key=value>] [--rollout <0-100>] [--json]");
  io.stdout.log("  evo observe canary [--fixture <id>] [--input <path>] [--json]");
  io.stdout.log("  evo observe input --surface <surfaceId> --branch-id <id> [--state <path>] [--json]");
  io.stdout.log("  evo observe fixtures [--json]");
  io.stdout.log("  evo branch list [--state <path>] [--surface <surfaceId>] [--status <status>] [--json]");
  io.stdout.log("  evo branch create --surface <surfaceId> [--branch <name>] [--segment <key=value>] [--state <path>] [--json]");
  io.stdout.log("  evo branch approve <branchId> [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo branch rollout <branchId> --percentage <0-100> [--state <path>] [--actor <name>] [--approved] [--json]");
  io.stdout.log("  evo branch promote <branchId> --approved --eval-passed [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo branch revert <branchId> --reason <reason> [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo branch sunset <branchId> [--state <path>] [--actor <name>] [--json]");
  io.stdout.log("  evo db status [--migrations-dir <path>] [--json]");
  io.stdout.log("  evo db migrate [--database-url <url>] [--migrations-dir <path>] [--dry-run] [--json]");
  io.stdout.log("  evo eval patch-boundary [--surface <surfaceId>] [--changed-file <path>] [--diff <path>]");
  io.stdout.log("  evo eval security [--changed-file <path>] [--diff <path>] [--allow-risk <category>]");
  io.stdout.log("  evo eval report [--surface <surfaceId>] [--changed-file <path>] [--diff <path>]");
  io.stdout.log("  evo eval fixtures [--json]");
  io.stdout.log("  evo eval fixture <fixtureId> [--json]");
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

async function policyCheckCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const surfaceId = readOption(args, "surface");

  if (!surfaceId) {
    io.stderr.error("Missing required --surface <surfaceId>");
    return 1;
  }

  const rolloutValue = readOption(args, "rollout");
  const rolloutPercentage = rolloutValue ? parseRolloutPercentage(rolloutValue) : undefined;
  const decision = evaluatePolicy({
    manifest: await loadManifest(manifestPath),
    surfaceId,
    action: rolloutPercentage === undefined ? "patch" : "rollout",
    changeCategories: readRepeatedOption(args, "change"),
    rolloutPercentage,
    actor: readOption(args, "actor"),
    humanApproved: hasFlag(args, "approved") || hasFlag(args, "human-approved")
  });

  if (hasFlag(args, "json")) {
    io.stdout.log(JSON.stringify(decision, null, 2));
    return decision.allowed ? 0 : 1;
  }

  io.stdout.log(`Policy: ${decision.allowed ? "allowed" : "blocked"}`);

  for (const reason of decision.reasons) {
    io.stdout.log(`- ${reason}`);
  }

  if (decision.requiredApprovals.length > 0) {
    io.stdout.log(`Required approvals: ${decision.requiredApprovals.join(", ")}`);
  }

  return decision.allowed ? 0 : 1;
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
  const outputPath = readOption(args, "output") ?? defaultLocalDemoStatePath;
  const generatedAt = new Date().toISOString();
  const branch = createDemoBranch(manifest.app.id, surfaceId, generatedAt);
  const seed: LocalDemoState = {
    path: outputPath,
    data: {
      appId: manifest.app.id,
      surfaceId,
      generatedAt,
      metricEvents: createDemoMetricEvents(manifest.app.id, surfaceId, branch.id)
    },
    signals: createDemoSignals(manifest.app.id, surfaceId, count),
    branches: [branch],
    auditLogs: createDemoSeedAuditLogs(branch, generatedAt)
  };

  await writeLocalDemoState(seed);

  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          outputPath,
          ...seed.data,
          signals: seed.signals,
          metricEvents: seed.data.metricEvents,
          branches: seed.branches,
          auditLogs: seed.auditLogs
        },
        null,
        2
      )
    );
    return 0;
  }

  io.stdout.log(`Seeded ${seed.signals.length} demo signals for ${surfaceId}`);
  io.stdout.log(`Seeded ${readMetricEventsFromState(seed).length} demo metric events`);
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

async function observeCanaryCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const input = await readCanaryObservationInput(args);
  const manifest = await loadManifest(manifestPath);
  const surface = findSurface(manifest, input.surfaceId);

  if (!surface) {
    throw new Error(`Surface not found: ${input.surfaceId}`);
  }

  if (manifest.app.id !== input.appId) {
    throw new Error(`Canary appId ${input.appId} does not match manifest app ${manifest.app.id}`);
  }

  const report = analyzeCanary(input);

  if (hasFlag(args, "json")) {
    io.stdout.log(JSON.stringify(report, null, 2));
    return report.recommendation === "rollback" ? 1 : 0;
  }

  io.stdout.log(`Canary: ${report.status}`);
  io.stdout.log(`Recommendation: ${report.recommendation}`);
  io.stdout.log(`Surface: ${report.surfaceId}`);
  io.stdout.log(`Branch: ${report.branchName ?? report.branchId}`);
  io.stdout.log(`Rollout: ${report.rolloutPercentage}%`);
  io.stdout.log(`Sample: ${report.sampleSize}/${report.minSampleSize}`);
  io.stdout.log("Reasons:");

  for (const reason of report.reasons) {
    io.stdout.log(`- ${reason}`);
  }

  io.stdout.log("Metrics:");

  for (const metric of report.metrics) {
    io.stdout.log(
      `- ${metric.name}\t${metric.status}\tchange=${metric.changePercent}%\tregression=${metric.regressionPercent}%`
    );
  }

  io.stdout.log(`Audit: ${report.audit.event}`);
  return report.recommendation === "rollback" ? 1 : 0;
}

async function observeInputCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const manifest = await loadManifest(manifestPath);
  const surfaceId =
    readOption(args, "surface") ?? args.find((arg) => !arg.startsWith("--"));

  if (!surfaceId) {
    io.stderr.error("Missing required surfaceId");
    return 1;
  }

  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    io.stderr.error(`Surface not found: ${surfaceId}`);
    return 1;
  }

  const branchId = readOption(args, "branch-id") ?? "br_demo_seed";
  const rolloutPercentage = parseRolloutPercentage(readOption(args, "rollout") ?? "25");
  const minSampleSize = parseOptionalInteger(readOption(args, "min-sample"));
  const events = await readMetricEvents(args, manifest.app.id, surfaceId);
  const input = buildCanaryInputFromMetricEvents({
    appId: manifest.app.id,
    surfaceId,
    branchId,
    ...(readOption(args, "branch") ? { branchName: readOption(args, "branch") } : {}),
    rolloutPercentage,
    events,
    ...(minSampleSize !== undefined ? { minSampleSize } : {}),
    ...(readOption(args, "observed-at") ? { observedAt: readOption(args, "observed-at") } : {})
  });

  if (hasFlag(args, "json")) {
    io.stdout.log(JSON.stringify(input, null, 2));
    return 0;
  }

  io.stdout.log(`Canary input: ${input.surfaceId}`);
  io.stdout.log(`Branch: ${input.branchName ?? input.branchId}`);
  io.stdout.log(`Rollout: ${input.rolloutPercentage}%`);
  io.stdout.log(`Sample: ${input.sampleSize}${input.minSampleSize ? `/${input.minSampleSize}` : ""}`);
  io.stdout.log("Metrics:");

  for (const metric of input.metrics) {
    io.stdout.log(
      `- ${metric.name}\tbaseline=${metric.baseline}\tcanary=${metric.canary}\tdirection=${metric.direction}`
    );
  }

  return 0;
}

function observeFixturesCommand(args: string[], io: CliIO): number {
  const fixtures = listCanaryFixtures();

  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          fixtures: fixtures.map((fixture) => ({
            id: fixture.id,
            appId: fixture.input.appId,
            surfaceId: fixture.input.surfaceId,
            branchId: fixture.input.branchId,
            sampleSize: fixture.input.sampleSize
          }))
        },
        null,
        2
      )
    );
    return 0;
  }

  for (const fixture of fixtures) {
    io.stdout.log(
      `${fixture.id}\t${fixture.input.surfaceId}\t${fixture.input.rolloutPercentage}%\t${fixture.input.sampleSize}`
    );
  }

  return 0;
}

async function branchListCommand(args: string[], io: CliIO): Promise<number> {
  const state = await readLocalDemoState(readBranchStatePath(args));
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

async function branchCreateCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const surfaceId = readOption(args, "surface");

  if (!surfaceId) {
    throw new Error("Missing required --surface <surfaceId>");
  }

  const manifest = await loadManifest(manifestPath);
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    throw new Error(`Surface not found: ${surfaceId}`);
  }

  const statePath = readBranchStatePath(args);
  const state = await readOrCreateLocalDemoState(statePath, {
    appId: manifest.app.id,
    surfaceId
  });
  const actor = readOption(args, "actor") ?? "local-maintainer";
  const branchName = readOption(args, "branch") ?? `${surfaceId}.local-draft.v1`;
  const targetSegments = readSegmentOptions(args);
  const { branch, auditLog } = createLocalBranch(state, {
    appId: manifest.app.id,
    surfaceId,
    branchName,
    branchId: readOption(args, "branch-id"),
    gitBranch: `evofork/${branchName}`,
    targetSegments:
      Object.keys(targetSegments).length > 0
        ? targetSegments
        : {
            lifecycle_stage: "new_user"
          },
    priority: parseOptionalInteger(readOption(args, "priority")) ?? 10,
    actor
  });

  await writeLocalDemoState(state);

  return printBranchMutationResult(args, io, state.path, branch, auditLog);
}

async function branchApproveCommand(args: string[], io: CliIO): Promise<number> {
  return await mutateLocalBranchCommand(args, io, (state, branchId, actor) =>
    approveLocalBranch(state, branchId, actor)
  );
}

async function branchRolloutCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const branchId = readPositionalArgs(args)[0];

  if (!branchId) {
    throw new Error("Missing required branchId");
  }

  const percentageOption = readOption(args, "percentage") ?? readOption(args, "rollout");

  if (!percentageOption) {
    throw new Error("--percentage is required");
  }

  const percentage = parseRolloutPercentage(percentageOption);
  const state = await readLocalDemoState(readBranchStatePath(args));
  const branch = state.branches.find((candidate) => candidate.id === branchId);

  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  const actor = readOption(args, "actor") ?? "local-maintainer";
  const manifest = await loadManifest(manifestPath);
  const policyDecision = evaluatePolicy({
    manifest,
    surfaceId: branch.surfaceId,
    action: "rollout",
    rolloutPercentage: percentage,
    actor,
    humanApproved: hasFlag(args, "approved") || hasFlag(args, "human-approved")
  });
  const policyAuditLog = recordLocalBranchAuditLog(
    state,
    branchId,
    actor,
    policyDecision.audit.event,
    {
      ...policyDecision.audit.payload,
      reasons: policyDecision.reasons,
      requiredApprovals: policyDecision.requiredApprovals
    }
  );

  if (!policyDecision.allowed) {
    await writeLocalDemoState(state);
    return printBranchPolicyBlockedResult(
      args,
      io,
      state.path,
      branch,
      policyDecision,
      policyAuditLog
    );
  }

  const { branch: updatedBranch, auditLog } = rolloutLocalBranch(
    state,
    branchId,
    percentage,
    actor
  );

  await writeLocalDemoState(state);
  return printBranchMutationResult(args, io, state.path, updatedBranch, auditLog, policyAuditLog);
}

async function branchPromoteCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const branchId = readPositionalArgs(args)[0];

  if (!branchId) {
    throw new Error("Missing required branchId");
  }

  const state = await readLocalDemoState(readBranchStatePath(args));
  const branch = state.branches.find((candidate) => candidate.id === branchId);

  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  const actor = readOption(args, "actor") ?? "local-maintainer";
  const manifest = await loadManifest(manifestPath);
  const policyDecision = evaluatePolicy({
    manifest,
    surfaceId: branch.surfaceId,
    action: "promote",
    rolloutPercentage: 100,
    actor,
    humanApproved: hasFlag(args, "approved") || hasFlag(args, "human-approved")
  });
  const policyAuditLog = recordLocalBranchAuditLog(
    state,
    branchId,
    actor,
    policyDecision.audit.event,
    {
      ...policyDecision.audit.payload,
      reasons: policyDecision.reasons,
      requiredApprovals: policyDecision.requiredApprovals
    }
  );

  if (!policyDecision.allowed) {
    await writeLocalDemoState(state);
    return printBranchPolicyBlockedResult(
      args,
      io,
      state.path,
      branch,
      policyDecision,
      policyAuditLog
    );
  }

  if (!branchEvalPassed(branch) && !hasFlag(args, "eval-passed")) {
    const evalAuditLog = recordLocalBranchAuditLog(
      state,
      branchId,
      actor,
      "eval_blocked",
      {
        action: "promote",
        reason: "Eval Gate must pass before promotion."
      }
    );

    await writeLocalDemoState(state);
    return printBranchEvalBlockedResult(args, io, state.path, branch, evalAuditLog);
  }

  const evalAuditLog = recordLocalBranchAuditLog(
    state,
    branchId,
    actor,
    "eval_allowed",
    {
      action: "promote",
      source: hasFlag(args, "eval-passed") ? "cli_flag" : "branch_eval_report"
    }
  );
  const { branch: updatedBranch, auditLog } = promoteLocalBranch(state, branchId, actor);

  await writeLocalDemoState(state);
  return printBranchMutationResult(
    args,
    io,
    state.path,
    updatedBranch,
    auditLog,
    policyAuditLog,
    evalAuditLog
  );
}

async function branchRevertCommand(args: string[], io: CliIO): Promise<number> {
  const reason = readOption(args, "reason");

  if (!reason) {
    throw new Error("--reason is required");
  }

  return await mutateLocalBranchCommand(args, io, (state, branchId, actor) =>
    revertLocalBranch(state, branchId, reason, actor)
  );
}

async function branchSunsetCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const branchId = readPositionalArgs(args)[0];

  if (!branchId) {
    throw new Error("Missing required branchId");
  }

  const state = await readLocalDemoState(readBranchStatePath(args));
  const branch = state.branches.find((candidate) => candidate.id === branchId);

  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  const actor = readOption(args, "actor") ?? "local-maintainer";
  const manifest = await loadManifest(manifestPath);
  const policyDecision = evaluatePolicy({
    manifest,
    surfaceId: branch.surfaceId,
    action: "sunset",
    actor,
    humanApproved: hasFlag(args, "approved") || hasFlag(args, "human-approved")
  });
  const policyAuditLog = recordLocalBranchAuditLog(
    state,
    branchId,
    actor,
    policyDecision.audit.event,
    {
      ...policyDecision.audit.payload,
      reasons: policyDecision.reasons,
      requiredApprovals: policyDecision.requiredApprovals
    }
  );

  if (!policyDecision.allowed) {
    await writeLocalDemoState(state);
    return printBranchPolicyBlockedResult(
      args,
      io,
      state.path,
      branch,
      policyDecision,
      policyAuditLog
    );
  }

  const { branch: updatedBranch, auditLog } = sunsetLocalBranch(state, branchId, actor);

  await writeLocalDemoState(state);
  return printBranchMutationResult(args, io, state.path, updatedBranch, auditLog, policyAuditLog);
}

async function mutateLocalBranchCommand(
  args: string[],
  io: CliIO,
  mutate: (
    state: LocalDemoState,
    branchId: string,
    actor: string
  ) => { branch: BranchRecord; auditLog: AuditLogRecord }
): Promise<number> {
  const branchId = readPositionalArgs(args)[0];

  if (!branchId) {
    throw new Error("Missing required branchId");
  }

  const state = await readLocalDemoState(readBranchStatePath(args));
  const actor = readOption(args, "actor") ?? "local-maintainer";
  const { branch, auditLog } = mutate(state, branchId, actor);

  await writeLocalDemoState(state);
  return printBranchMutationResult(args, io, state.path, branch, auditLog);
}

function printBranchMutationResult(
  args: string[],
  io: CliIO,
  statePath: string,
  branch: BranchRecord,
  auditLog: AuditLogRecord,
  policyAuditLog?: AuditLogRecord,
  evalAuditLog?: AuditLogRecord
): number {
  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          statePath,
          branch,
          auditLog,
          policyAuditLog,
          evalAuditLog
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
  if (policyAuditLog) {
    io.stdout.log(`Policy: ${policyAuditLog.event}`);
  }
  if (evalAuditLog) {
    io.stdout.log(`Eval: ${evalAuditLog.event}`);
  }
  io.stdout.log(`Audit: ${auditLog.event}`);
  io.stdout.log(`State: ${statePath}`);
  return 0;
}

function printBranchPolicyBlockedResult(
  args: string[],
  io: CliIO,
  statePath: string,
  branch: BranchRecord,
  policyDecision: PolicyDecision,
  auditLog: AuditLogRecord
): number {
  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          statePath,
          branch,
          policyDecision,
          auditLog
        },
        null,
        2
      )
    );
    return 1;
  }

  io.stderr.error(`Policy blocked ${policyDecision.action} for ${branch.id}`);
  for (const reason of policyDecision.reasons) {
    io.stderr.error(`- ${reason}`);
  }
  if (policyDecision.requiredApprovals.length > 0) {
    io.stderr.error(`Required approvals: ${policyDecision.requiredApprovals.join(", ")}`);
  }
  io.stderr.error(`Audit: ${auditLog.event}`);
  io.stderr.error(`State: ${statePath}`);
  return 1;
}

function printBranchEvalBlockedResult(
  args: string[],
  io: CliIO,
  statePath: string,
  branch: BranchRecord,
  auditLog: AuditLogRecord
): number {
  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          statePath,
          branch,
          auditLog,
          error: "eval_gate_required"
        },
        null,
        2
      )
    );
    return 1;
  }

  io.stderr.error(`Eval Gate blocked promotion for ${branch.id}`);
  io.stderr.error("- Eval Gate must pass before promotion.");
  io.stderr.error(`Audit: ${auditLog.event}`);
  io.stderr.error(`State: ${statePath}`);
  return 1;
}

function branchEvalPassed(branch: BranchRecord): boolean {
  return isRecord(branch.evalReport) && branch.evalReport.status === "passed";
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

async function readCanaryObservationInput(args: string[]): Promise<CanaryObservationInput> {
  const inputPath = readOption(args, "input");

  if (inputPath) {
    return parseCanaryObservationInput(JSON.parse(await readFile(inputPath, "utf8")));
  }

  const fixtureId = readOption(args, "fixture") ?? "healthy";

  if (!isCanaryFixtureId(fixtureId)) {
    throw new Error(`Unknown canary fixture: ${fixtureId}`);
  }

  return getCanaryFixture(fixtureId);
}

async function readMetricEvents(
  args: string[],
  appId: string,
  surfaceId: string
): Promise<CanaryMetricEventInput[]> {
  const eventsPath = readOption(args, "events");

  if (eventsPath) {
    return parseMetricEvents(JSON.parse(await readFile(eventsPath, "utf8")));
  }

  const endpoint = readOption(args, "endpoint");

  if (endpoint) {
    return await fetchMetricEvents(endpoint, appId, surfaceId, readOption(args, "event"));
  }

  const state = await readLocalDemoState(readBranchStatePath(args));
  const events = readMetricEventsFromState(state);

  if (events.length === 0) {
    throw new Error(
      `No metric events found in ${state.path}. Run evo demo seed or pass --events/--endpoint.`
    );
  }

  return events;
}

async function fetchMetricEvents(
  endpoint: string,
  appId: string,
  surfaceId: string,
  eventName = "metric_observed"
): Promise<CanaryMetricEventInput[]> {
  if (!globalThis.fetch) {
    throw new Error("Fetching metric events requires a global fetch implementation");
  }

  const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
  const url = new URL("v1/events", base);
  url.searchParams.set("appId", appId);
  url.searchParams.set("surfaceId", surfaceId);
  url.searchParams.set("event", eventName);

  const response = await globalThis.fetch(url);

  if (!response.ok) {
    throw new Error(`Metric event request failed with status ${response.status}`);
  }

  return parseMetricEvents(await response.json());
}

function readMetricEventsFromState(state: LocalDemoState): CanaryMetricEventInput[] {
  return parseMetricEvents({
    events: state.data.metricEvents
  });
}

function parseMetricEvents(value: unknown): CanaryMetricEventInput[] {
  const events = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.events)
      ? value.events
      : isRecord(value) && Array.isArray(value.metricEvents)
        ? value.metricEvents
        : undefined;

  if (!events) {
    return [];
  }

  return events.flatMap((event): CanaryMetricEventInput[] =>
    isMetricEvent(event) ? [event] : []
  );
}

function isMetricEvent(value: unknown): value is CanaryMetricEventInput {
  return (
    isRecord(value) &&
    typeof value.appId === "string" &&
    typeof value.event === "string" &&
    (value.surfaceId === undefined || typeof value.surfaceId === "string") &&
    (value.branchId === undefined || value.branchId === null || typeof value.branchId === "string") &&
    (value.userId === undefined || typeof value.userId === "string") &&
    (value.sessionId === undefined || typeof value.sessionId === "string") &&
    (value.properties === undefined || isRecord(value.properties))
  );
}

function parseCanaryObservationInput(value: unknown): CanaryObservationInput {
  if (!isRecord(value)) {
    throw new Error("Canary input must be a JSON object");
  }

  const metrics = value.metrics;

  if (!Array.isArray(metrics)) {
    throw new Error("Canary input metrics must be an array");
  }

  return {
    appId: readStringField(value, "appId"),
    surfaceId: readStringField(value, "surfaceId"),
    branchId: readStringField(value, "branchId"),
    ...(typeof value.branchName === "string" ? { branchName: value.branchName } : {}),
    rolloutPercentage: readNumberField(value, "rolloutPercentage"),
    sampleSize: readNumberField(value, "sampleSize"),
    ...(typeof value.minSampleSize === "number" ? { minSampleSize: value.minSampleSize } : {}),
    metrics: metrics.map(parseCanaryMetricInput),
    ...(Array.isArray(value.guardrailFailures)
      ? { guardrailFailures: value.guardrailFailures.map((failure) => String(failure)) }
      : {}),
    ...(typeof value.observedAt === "string" ? { observedAt: value.observedAt } : {})
  };
}

function parseCanaryMetricInput(value: unknown): CanaryObservationInput["metrics"][number] {
  if (!isRecord(value)) {
    throw new Error("Each canary metric must be a JSON object");
  }

  const direction = readStringField(value, "direction");

  if (direction !== "increase" && direction !== "decrease") {
    throw new Error(`Invalid canary metric direction: ${direction}`);
  }

  return {
    name: readStringField(value, "name"),
    baseline: readNumberField(value, "baseline"),
    canary: readNumberField(value, "canary"),
    direction,
    ...(typeof value.warnRegressionPercent === "number"
      ? { warnRegressionPercent: value.warnRegressionPercent }
      : {}),
    ...(typeof value.failRegressionPercent === "number"
      ? { failRegressionPercent: value.failRegressionPercent }
      : {})
  };
}

function createDemoBranch(appId: string, surfaceId: string, createdAt: string): BranchRecord {
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
    priority: 10,
    createdBy: "demo_seed",
    createdAt,
    updatedAt: createdAt
  };
}

function readBranchStatePath(args: string[]): string {
  return readOption(args, "state") ?? readOption(args, "file") ?? defaultLocalDemoStatePath;
}

async function dbStatusCommand(args: string[], io: CliIO): Promise<number> {
  const migrations = await listMigrationFiles(readOption(args, "migrations-dir"));

  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          migrations
        },
        null,
        2
      )
    );
    return 0;
  }

  io.stdout.log(`Migrations: ${migrations.length}`);

  for (const migration of migrations) {
    io.stdout.log(`- ${migration.id}\t${migration.path}`);
  }

  return 0;
}

async function dbMigrateCommand(args: string[], io: CliIO): Promise<number> {
  const migrations = await listMigrationFiles(readOption(args, "migrations-dir"));
  const databaseUrl = readOption(args, "database-url") ?? process.env.DATABASE_URL;
  const dryRun = hasFlag(args, "dry-run");

  if (dryRun) {
    printMigrationResult(
      io,
      {
        dryRun,
        migrations,
        applied: []
      },
      hasFlag(args, "json")
    );
    return 0;
  }

  if (!databaseUrl) {
    throw new Error("evo db migrate requires --database-url or DATABASE_URL unless --dry-run is used");
  }

  const applied: MigrationFile[] = [];

  for (const migration of migrations) {
    await execPsql(databaseUrl, migration.path);
    applied.push(migration);
  }

  printMigrationResult(
    io,
    {
      dryRun,
      migrations,
      applied
    },
    hasFlag(args, "json")
  );

  return 0;
}

function printMigrationResult(
  io: CliIO,
  result: { dryRun: boolean; migrations: MigrationFile[]; applied: MigrationFile[] },
  json: boolean
): void {
  if (json) {
    io.stdout.log(JSON.stringify(result, null, 2));
    return;
  }

  const action = result.dryRun ? "Would apply" : "Applied";
  const migrations = result.dryRun ? result.migrations : result.applied;

  io.stdout.log(`${action} ${migrations.length} migration(s):`);

  for (const migration of migrations) {
    io.stdout.log(`- ${migration.id}\t${migration.path}`);
  }
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

function evalFixturesCommand(args: string[], io: CliIO): number {
  const fixtures = listSafetyFixtures();

  if (hasFlag(args, "json")) {
    io.stdout.log(
      JSON.stringify(
        {
          fixtures: fixtures.map((fixture) => ({
            id: fixture.id,
            title: fixture.title,
            surfaceId: fixture.surfaceId,
            expected: fixture.expected
          }))
        },
        null,
        2
      )
    );
    return 0;
  }

  for (const fixture of fixtures) {
    io.stdout.log(
      `${fixture.id}\t${fixture.surfaceId}\t${fixture.expected.evalStatus}\t${fixture.title}`
    );
  }

  return 0;
}

async function evalFixtureCommand(
  manifestPath: string,
  args: string[],
  io: CliIO
): Promise<number> {
  const fixtureId = readPositionalArgs(args)[0];

  if (!fixtureId) {
    throw new Error("Missing required fixtureId");
  }

  const fixture = findSafetyFixture(fixtureId);

  if (!fixture) {
    throw new Error(`Safety fixture not found: ${fixtureId}`);
  }

  const manifest = await loadManifest(manifestPath);
  const evalReport = runEvalGate(createEvalInputFromFixture(manifest, fixture));
  const policyDecision = fixture.policy
    ? evaluatePolicy({
        manifest,
        surfaceId: fixture.surfaceId,
        actor: "safety-fixture",
        ...fixture.policy
      })
    : undefined;
  const passed = safetyFixturePassed(fixture, evalReport, policyDecision);
  const result = {
    fixture: {
      id: fixture.id,
      title: fixture.title,
      surfaceId: fixture.surfaceId
    },
    expected: fixture.expected,
    evalReport,
    policyDecision,
    passed
  };

  if (hasFlag(args, "json")) {
    io.stdout.log(JSON.stringify(result, null, 2));
    return passed ? 0 : 1;
  }

  io.stdout.log(`Fixture: ${fixture.id}`);
  io.stdout.log(`Eval: ${evalReport.status} (expected ${fixture.expected.evalStatus})`);
  if (policyDecision && fixture.expected.policyAllowed !== undefined) {
    io.stdout.log(
      `Policy: ${policyDecision.allowed ? "allowed" : "blocked"} (expected ${
        fixture.expected.policyAllowed ? "allowed" : "blocked"
      })`
    );
  }
  io.stdout.log(`Result: ${passed ? "passed" : "failed"}`);
  return passed ? 0 : 1;
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
    diff,
    allowedSecurityCategories: readRepeatedOption(args, "allow-risk")
  };
}

function safetyFixturePassed(
  fixture: SafetyFixture,
  evalReport: EvalReport,
  policyDecision: PolicyDecision | undefined
): boolean {
  const evalMatches =
    evalReport.status === fixture.expected.evalStatus &&
    sameStringSet(evalReport.failures, fixture.expected.failedChecks);
  const policyMatches =
    fixture.expected.policyAllowed === undefined ||
    policyDecision?.allowed === fixture.expected.policyAllowed;

  return evalMatches && policyMatches;
}

function sameStringSet(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
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

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (value.trim() === "" || !Number.isInteger(parsed)) {
    throw new Error("Expected an integer value");
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

function createDemoMetricEvents(
  appId: string,
  surfaceId: string,
  branchId: string
): CanaryMetricEventInput[] {
  const events: CanaryMetricEventInput[] = [];

  for (let index = 0; index < 10; index += 1) {
    events.push(
      createDemoMetricEvent({
        appId,
        surfaceId,
        sessionId: `baseline_${index + 1}`,
        branchId: null,
        metric: "pricing_to_signup_conversion",
        value: index < 5 ? 1 : 0,
        direction: "increase",
        cohort: "baseline"
      }),
      createDemoMetricEvent({
        appId,
        surfaceId,
        sessionId: `baseline_${index + 1}`,
        branchId: null,
        metric: "page_error_rate",
        value: index === 0 ? 1 : 0,
        direction: "decrease",
        cohort: "baseline"
      }),
      createDemoMetricEvent({
        appId,
        surfaceId,
        sessionId: `canary_${index + 1}`,
        branchId,
        metric: "pricing_to_signup_conversion",
        value: index < 7 ? 1 : 0,
        direction: "increase",
        cohort: "canary"
      }),
      createDemoMetricEvent({
        appId,
        surfaceId,
        sessionId: `canary_${index + 1}`,
        branchId,
        metric: "page_error_rate",
        value: 0,
        direction: "decrease",
        cohort: "canary"
      })
    );
  }

  return events;
}

function createDemoMetricEvent(input: {
  appId: string;
  surfaceId: string;
  sessionId: string;
  branchId: string | null;
  metric: string;
  value: number;
  direction: "increase" | "decrease";
  cohort: "baseline" | "canary";
}): CanaryMetricEventInput {
  return {
    appId: input.appId,
    event: "metric_observed",
    surfaceId: input.surfaceId,
    branchId: input.branchId,
    sessionId: input.sessionId,
    properties: {
      metric: input.metric,
      value: input.value,
      direction: input.direction,
      cohort: input.cohort,
      source: "local_demo_seed"
    }
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringField(value: Record<string, unknown>, name: string): string {
  const field = value[name];

  if (typeof field !== "string" || field.trim() === "") {
    throw new Error(`Canary input field ${name} must be a non-empty string`);
  }

  return field;
}

function readNumberField(value: Record<string, unknown>, name: string): number {
  const field = value[name];

  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(`Canary input field ${name} must be a finite number`);
  }

  return field;
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

async function execPsql(databaseUrl: string, migrationPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      "psql",
      [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", migrationPath],
      { cwd: process.cwd() },
      (error, _stdout, stderr) => {
        if (error) {
          const message =
            "code" in error && error.code === "ENOENT"
              ? "psql is required to run evo db migrate"
              : String(stderr || error.message);
          reject(new Error(message));
          return;
        }

        resolve();
      }
    );
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
