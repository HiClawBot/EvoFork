import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  evoforkTableNames,
  formatMigrationPlan,
  listMigrationFiles,
  schema
} from "../src/index.js";

describe("@evofork/db", () => {
  it("exports the v0.1 persistence schema tables", () => {
    expect(Object.keys(schema).sort()).toEqual(
      [
        "apps",
        "auditLogs",
        "evalReports",
        "evoforkMeta",
        "evoBranches",
        "feedbackSignals",
        "rfcs",
        "variantExposures"
      ].sort()
    );
  });

  it("keeps migrations aligned with exported table names", async () => {
    const migrations = await Promise.all(
      ["0001_initial.sql", "0002_workspace_metadata.sql"].map((name) =>
        readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8")
      )
    );
    const combinedSql = migrations.join("\n");

    for (const tableName of evoforkTableNames) {
      expect(combinedSql).toContain(`create table if not exists ${tableName}`);
    }
  });

  it("documents safety constraints in the branch schema migration", async () => {
    const migration = await readFile(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("rollout_percentage >= 0");
    expect(migration).toContain("rollout_percentage <= 100");
    expect(migration).toContain("'reverted'");
  });

  it("lists migrations in deterministic order", async () => {
    const migrations = await listMigrationFiles();

    expect(migrations.map((migration) => migration.name)).toEqual([
      "0001_initial.sql",
      "0002_workspace_metadata.sql"
    ]);
    expect(formatMigrationPlan(migrations)[0]).toContain("0001_initial");
  });

  it("records v0.4 workspace metadata in migrations", async () => {
    const migration = await readFile(
      new URL("../migrations/0002_workspace_metadata.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("schema_version");
    expect(migration).toContain("multi-app-workspace");
    expect(migration).toContain("on conflict (key) do update");
  });
});
