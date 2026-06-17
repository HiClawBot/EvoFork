import { readFile } from "node:fs/promises";
import { posix as posixPath } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const moduleId = "@evofork/manifest-parser";

export const evoSurfaceTypes = [
  "react-component",
  "api-route",
  "llm-prompt",
  "markdown-doc",
  "config"
] as const;

export type EvoSurfaceType = (typeof evoSurfaceTypes)[number];

const nonEmptyStringSchema = z.string().trim().min(1);

const repoRelativePathSchema = z.string().superRefine((value, context) => {
  const result = validateRepoRelativePath(value);

  if (!result.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.reason
    });
  }
});

const targetMetricsSchema = z.object({
  primary: nonEmptyStringSchema,
  guardrails: z.array(nonEmptyStringSchema)
});

const rolloutSchema = z.object({
  max_auto_percentage: z.number().min(0).max(100),
  require_human_approval: z.boolean()
});

export const evoSurfaceSchema = z.object({
  id: nonEmptyStringSchema,
  type: z.enum(evoSurfaceTypes),
  path: repoRelativePathSchema,
  owner: nonEmptyStringSchema,
  allowed_changes: z.array(nonEmptyStringSchema).min(1),
  forbidden_changes: z.array(nonEmptyStringSchema),
  target_metrics: targetMetricsSchema.optional(),
  tests: z.array(nonEmptyStringSchema).optional(),
  rollout: rolloutSchema.optional()
});

export const evoManifestSchema = z
  .object({
    app: z.object({
      id: nonEmptyStringSchema,
      name: nonEmptyStringSchema.optional(),
      default_branch: nonEmptyStringSchema
    }),
    surfaces: z.array(evoSurfaceSchema).min(1)
  })
  .superRefine((manifest, context) => {
    const seenSurfaceIds = new Set<string>();

    manifest.surfaces.forEach((surface, index) => {
      if (seenSurfaceIds.has(surface.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate surface id: ${surface.id}`,
          path: ["surfaces", index, "id"]
        });
      }

      seenSurfaceIds.add(surface.id);
    });
  });

export type EvoSurface = z.infer<typeof evoSurfaceSchema>;
export type EvoManifest = z.infer<typeof evoManifestSchema>;

export type ChangedFile = string | { path: string };

export async function loadManifest(manifestPath: string): Promise<EvoManifest> {
  const manifestSource = await readFile(manifestPath, "utf8");
  const parsedManifest = parseYaml(manifestSource);

  return validateManifest(parsedManifest);
}

export function validateManifest(input: unknown): EvoManifest {
  return evoManifestSchema.parse(input);
}

export function listSurfaces(manifest: EvoManifest): EvoSurface[] {
  return [...manifest.surfaces];
}

export function findSurface(
  manifest: EvoManifest,
  surfaceId: string
): EvoSurface | undefined {
  return manifest.surfaces.find((surface) => surface.id === surfaceId);
}

export function assertSurfacePathAllowed(
  manifest: EvoManifest,
  surfaceId: string,
  changedFiles: ChangedFile[]
): void {
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    throw new Error(`Unknown surface id: ${surfaceId}`);
  }

  for (const changedFile of changedFiles) {
    const changedPath = typeof changedFile === "string" ? changedFile : changedFile.path;
    const result = validateRepoRelativePath(changedPath);

    if (!result.success) {
      throw new Error(`Invalid changed file path: ${changedPath}. ${result.reason}`);
    }

    if (changedPath !== surface.path) {
      throw new Error(
        `Unauthorized file for surface ${surfaceId}: ${changedPath}. Allowed path: ${surface.path}`
      );
    }
  }
}

type PathValidationResult =
  | {
      success: true;
    }
  | {
      success: false;
      reason: string;
    };

function validateRepoRelativePath(value: string): PathValidationResult {
  if (!value || value.trim() !== value) {
    return {
      success: false,
      reason: "Path must be non-empty and must not have leading or trailing whitespace"
    };
  }

  if (value.includes("\\")) {
    return {
      success: false,
      reason: "Path must use POSIX separators"
    };
  }

  if (value.startsWith("/") || /^[A-Za-z]:\//.test(value)) {
    return {
      success: false,
      reason: "Path must be relative to the repository root"
    };
  }

  const normalizedPath = posixPath.normalize(value);

  if (normalizedPath !== value) {
    return {
      success: false,
      reason: `Path must be normalized: ${normalizedPath}`
    };
  }

  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return {
      success: false,
      reason: "Path must not escape the repository root"
    };
  }

  return {
    success: true
  };
}
