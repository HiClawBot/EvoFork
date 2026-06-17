import type { RfcDraft } from "@evofork/adapter-llm-mock";
import {
  assertSurfacePathAllowed,
  findSurface,
  type EvoManifest,
  type EvoSurface
} from "@evofork/manifest-parser";

export const serviceId = "@evofork/patch-agent";

export type PatchBoundaryInput = {
  diff: string;
  manifest: EvoManifest;
  surfaceId: string;
  forbiddenPathPatterns?: RegExp[];
};

export type PatchBoundaryReport = {
  allowed: boolean;
  surfaceId: string;
  changedFiles: string[];
  errors: string[];
};

export type PreparePullRequestInput = {
  rfc: RfcDraft;
  manifest: EvoManifest;
  surfaceId?: string;
  baseBranch?: string;
};

export type PreparedPullRequest = {
  branchName: string;
  title: string;
  body: string;
  patch: string;
  changedFiles: string[];
  boundary: PatchBoundaryReport;
};

const defaultForbiddenPathPatterns = [
  /(^|\/)\.env(\.|$)/i,
  /secret/i,
  /payment/i,
  /auth/i,
  /database/i,
  /schema/i,
  /legal/i,
  /privacy/i
];

export function parseChangedFilesFromDiff(diff: string): string[] {
  const changedFiles = new Set<string>();
  const diffHeaderPattern = /^diff --git a\/(.+?) b\/(.+)$/;

  for (const line of diff.split(/\r?\n/)) {
    const match = diffHeaderPattern.exec(line);

    if (!match) {
      continue;
    }

    const oldPath = match[1];
    const newPath = match[2];

    changedFiles.add(newPath === "/dev/null" ? oldPath : newPath);
  }

  return [...changedFiles];
}

export function checkPatchBoundary(input: PatchBoundaryInput): PatchBoundaryReport {
  const changedFiles = parseChangedFilesFromDiff(input.diff);
  const errors: string[] = [];

  if (changedFiles.length === 0) {
    errors.push("Patch did not include any changed files");
  }

  try {
    assertSurfacePathAllowed(input.manifest, input.surfaceId, changedFiles);
  } catch (error) {
    errors.push(normalizeError(error).message);
  }

  for (const file of changedFiles) {
    for (const pattern of input.forbiddenPathPatterns ?? defaultForbiddenPathPatterns) {
      if (pattern.test(file)) {
        errors.push(`Forbidden path pattern matched: ${file}`);
      }
    }
  }

  return {
    allowed: errors.length === 0,
    surfaceId: input.surfaceId,
    changedFiles,
    errors
  };
}

export function assertPatchBoundary(input: PatchBoundaryInput): PatchBoundaryReport {
  const report = checkPatchBoundary(input);

  if (!report.allowed) {
    throw new Error(report.errors.join("; "));
  }

  return report;
}

export function preparePullRequest(input: PreparePullRequestInput): PreparedPullRequest {
  const surfaceId = input.surfaceId ?? input.rfc.surfaceId;
  const surface = findSurface(input.manifest, surfaceId);

  if (!surface) {
    throw new Error(`Unknown surface id: ${surfaceId}`);
  }

  const branchName = suggestBranchName(input.rfc, surface);
  const patch = createDeterministicPatch(input.rfc, surface);
  const boundary = assertPatchBoundary({
    diff: patch,
    manifest: input.manifest,
    surfaceId
  });

  return {
    branchName,
    title: `EvoFork: ${input.rfc.problem}`,
    body: createPullRequestBody(input.rfc, surface, input.baseBranch ?? "main"),
    patch,
    changedFiles: boundary.changedFiles,
    boundary
  };
}

function suggestBranchName(rfc: RfcDraft, surface: EvoSurface): string {
  if (surface.id === "pricing.hero" && rfc.rfcId === "rfc_pricing_clarity_001") {
    return "pricing.hero.new-user-clarity.v1";
  }

  return `${surface.id}.${slugify(rfc.problem)}.v1`;
}

function createDeterministicPatch(rfc: RfcDraft, surface: EvoSurface): string {
  return [
    `diff --git a/${surface.path} b/${surface.path}`,
    `--- a/${surface.path}`,
    `+++ b/${surface.path}`,
    "@@",
    `+// EvoFork RFC ${rfc.rfcId}: ${rfc.proposedChanges[0]}`
  ].join("\n");
}

function createPullRequestBody(rfc: RfcDraft, surface: EvoSurface, baseBranch: string): string {
  return [
    `## EvoFork RFC`,
    ``,
    `- Surface: ${surface.id}`,
    `- Base branch: ${baseBranch}`,
    `- Problem: ${rfc.problem}`,
    `- Hypothesis: ${rfc.hypothesis}`,
    `- Evidence count: ${rfc.evidenceCount}`,
    `- Risk: ${rfc.risk}`,
    ``,
    `## Proposed Changes`,
    ...rfc.proposedChanges.map((change) => `- ${change}`),
    ``,
    `## Manifest Boundary`,
    `- Allowed path: ${surface.path}`,
    `- Allowed changes: ${surface.allowed_changes.join(", ")}`,
    `- Forbidden changes: ${surface.forbidden_changes.join(", ")}`,
    ``,
    `## Eval Plan`,
    `- pnpm evo manifest validate`,
    `- pnpm evo eval patch-boundary`,
    `- pnpm typecheck`,
    `- pnpm test`,
    ``,
    `## Rollout Suggestion`,
    `Start with the manifest-defined maximum and require approval when configured.`,
    ``,
    `## Rollback Plan`,
    `Revert this branch and route the surface back to default.`
  ].join("\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
