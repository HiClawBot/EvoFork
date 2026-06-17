import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type MigrationFile = {
  id: string;
  name: string;
  path: string;
};

export const defaultMigrationsDir = resolve(
  fileURLToPath(new URL("../migrations", import.meta.url))
);

export async function listMigrationFiles(
  migrationsDir = defaultMigrationsDir
): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => {
      const id = entry.name.replace(/\.sql$/, "");

      return {
        id,
        name: entry.name,
        path: resolve(migrationsDir, entry.name)
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function readMigrationSql(migration: MigrationFile): Promise<string> {
  return readFile(migration.path, "utf8");
}

export function formatMigrationPlan(migrations: MigrationFile[]): string[] {
  return migrations.map((migration) => `${migration.id}\t${migration.path}`);
}
