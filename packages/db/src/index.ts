import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const apps = pgTable("apps", {
  id: text("id").primaryKey(),
  name: text("name"),
  defaultBranch: text("default_branch").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const feedbackSignals = pgTable(
  "feedback_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    surfaceId: text("surface_id").notNull(),
    source: text("source").notNull(),
    signalType: text("signal_type").notNull(),
    text: text("text"),
    summary: text("summary"),
    severity: text("severity"),
    evidenceCount: integer("evidence_count").default(1).notNull(),
    segmentHints: jsonb("segment_hints").$type<Record<string, unknown>>().default({}).notNull(),
    piiRemoved: boolean("pii_removed").default(false).notNull(),
    llmEligible: boolean("llm_eligible").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    surfaceCreatedAtIdx: index("feedback_signals_app_surface_created_at_idx").on(
      table.appId,
      table.surfaceId,
      table.createdAt
    )
  })
);

export const rfcs = pgTable(
  "rfcs",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    surfaceId: text("surface_id").notNull(),
    problem: text("problem").notNull(),
    hypothesis: text("hypothesis").notNull(),
    proposedChanges: jsonb("proposed_changes").$type<string[]>().notNull(),
    targetMetric: text("target_metric"),
    guardrailMetrics: jsonb("guardrail_metrics").$type<string[]>().default([]).notNull(),
    risk: text("risk").notNull(),
    status: text("status").default("draft").notNull(),
    evidenceRefs: jsonb("evidence_refs").$type<string[]>().default([]).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    surfaceStatusIdx: index("rfcs_app_surface_status_idx").on(
      table.appId,
      table.surfaceId,
      table.status
    )
  })
);

export const evoBranches = pgTable(
  "evo_branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    surfaceId: text("surface_id").notNull(),
    rfcId: text("rfc_id").references(() => rfcs.id, { onDelete: "set null" }),
    branchName: text("branch_name").notNull(),
    baseVersion: text("base_version"),
    gitBranch: text("git_branch"),
    commitHash: text("commit_hash"),
    prUrl: text("pr_url"),
    status: text("status").notNull(),
    targetSegments: jsonb("target_segments").$type<Record<string, unknown>>().default({}).notNull(),
    rolloutPercentage: integer("rollout_percentage").default(0).notNull(),
    priority: integer("priority").default(0).notNull(),
    evalReport: jsonb("eval_report").$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    revertReason: text("revert_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    surfaceStatusIdx: index("evo_branches_app_surface_status_idx").on(
      table.appId,
      table.surfaceId,
      table.status
    ),
    branchNameIdx: uniqueIndex("evo_branches_app_surface_branch_name_idx").on(
      table.appId,
      table.surfaceId,
      table.branchName
    )
  })
);

export const variantExposures = pgTable(
  "variant_exposures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    surfaceId: text("surface_id").notNull(),
    branchId: uuid("branch_id").references(() => evoBranches.id, { onDelete: "set null" }),
    variant: text("variant").notNull(),
    userId: text("user_id"),
    sessionId: text("session_id"),
    segmentHints: jsonb("segment_hints").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    surfaceUserIdx: index("variant_exposures_app_surface_user_idx").on(
      table.appId,
      table.surfaceId,
      table.userId
    ),
    branchIdx: index("variant_exposures_branch_id_idx").on(table.branchId)
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    event: text("event").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    appCreatedAtIdx: index("audit_logs_app_created_at_idx").on(table.appId, table.createdAt),
    resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId)
  })
);

export const evalReports = pgTable(
  "eval_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => evoBranches.id, { onDelete: "set null" }),
    prUrl: text("pr_url"),
    status: text("status").notNull(),
    checks: jsonb("checks").$type<Record<string, boolean>>().notNull(),
    recommendation: text("recommendation"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    branchIdx: index("eval_reports_branch_id_idx").on(table.branchId)
  })
);

export const schema = {
  apps,
  feedbackSignals,
  rfcs,
  evoBranches,
  variantExposures,
  auditLogs,
  evalReports
};

export const evoforkTableNames = [
  "apps",
  "feedback_signals",
  "rfcs",
  "evo_branches",
  "variant_exposures",
  "audit_logs",
  "eval_reports"
] as const;

export type EvoforkTableName = (typeof evoforkTableNames)[number];
export type AppRecord = InferSelectModel<typeof apps>;
export type NewAppRecord = InferInsertModel<typeof apps>;
export type FeedbackSignalRecord = InferSelectModel<typeof feedbackSignals>;
export type NewFeedbackSignalRecord = InferInsertModel<typeof feedbackSignals>;
export type RfcRecord = InferSelectModel<typeof rfcs>;
export type NewRfcRecord = InferInsertModel<typeof rfcs>;
export type EvoBranchRecord = InferSelectModel<typeof evoBranches>;
export type NewEvoBranchRecord = InferInsertModel<typeof evoBranches>;
export type VariantExposureRecord = InferSelectModel<typeof variantExposures>;
export type NewVariantExposureRecord = InferInsertModel<typeof variantExposures>;
export type AuditLogDbRecord = InferSelectModel<typeof auditLogs>;
export type NewAuditLogDbRecord = InferInsertModel<typeof auditLogs>;
export type EvalReportRecord = InferSelectModel<typeof evalReports>;
export type NewEvalReportRecord = InferInsertModel<typeof evalReports>;

export * from "./migrations.js";
