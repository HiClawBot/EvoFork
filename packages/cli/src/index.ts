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
  const seed = {
    appId: manifest.app.id,
    surfaceId,
    generatedAt: new Date().toISOString(),
    signals: createDemoSignals(manifest.app.id, surfaceId, count)
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
  const branch: RouterBranch = {
    id: readOption(args, "branch-id") ?? "br_cli_route_test",
    appId: manifest.app.id,
    surfaceId,
    branchName,
    status: "active",
    targetSegments: segmentHints,
    rolloutPercentage,
    priority: 10
  };
  const result = resolveVariant(
    {
      appId: manifest.app.id,
      surfaceId,
      userId,
      segmentHints,
      personalizationOptOut: hasFlag(args, "opt-out")
    },
    [branch]
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

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
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
