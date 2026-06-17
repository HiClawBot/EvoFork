create extension if not exists pgcrypto;

create table if not exists apps (
  id text primary key,
  name text,
  default_branch text not null,
  created_at timestamptz not null default now()
);

create table if not exists feedback_signals (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references apps(id) on delete cascade,
  surface_id text not null,
  source text not null,
  signal_type text not null,
  text text,
  summary text,
  severity text,
  evidence_count integer not null default 1,
  segment_hints jsonb not null default '{}'::jsonb,
  pii_removed boolean not null default false,
  llm_eligible boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists feedback_signals_app_surface_created_at_idx
  on feedback_signals(app_id, surface_id, created_at);

create table if not exists rfcs (
  id text primary key,
  app_id text not null references apps(id) on delete cascade,
  surface_id text not null,
  problem text not null,
  hypothesis text not null,
  proposed_changes jsonb not null,
  target_metric text,
  guardrail_metrics jsonb not null default '[]'::jsonb,
  risk text not null,
  status text not null default 'draft',
  evidence_refs jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rfcs_app_surface_status_idx
  on rfcs(app_id, surface_id, status);

create table if not exists evo_branches (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references apps(id) on delete cascade,
  surface_id text not null,
  rfc_id text references rfcs(id) on delete set null,
  branch_name text not null,
  base_version text,
  git_branch text,
  commit_hash text,
  pr_url text,
  status text not null check (status in ('draft', 'canary', 'active', 'reverted', 'sunset')),
  target_segments jsonb not null default '{}'::jsonb,
  rollout_percentage integer not null default 0 check (
    rollout_percentage >= 0 and rollout_percentage <= 100
  ),
  priority integer not null default 0,
  eval_report jsonb not null default '{}'::jsonb,
  created_by text not null,
  approved_by text,
  revert_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evo_branches_app_surface_status_idx
  on evo_branches(app_id, surface_id, status);

create unique index if not exists evo_branches_app_surface_branch_name_idx
  on evo_branches(app_id, surface_id, branch_name);

create table if not exists variant_exposures (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references apps(id) on delete cascade,
  surface_id text not null,
  branch_id uuid references evo_branches(id) on delete set null,
  variant text not null,
  user_id text,
  session_id text,
  segment_hints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists variant_exposures_app_surface_user_idx
  on variant_exposures(app_id, surface_id, user_id);

create index if not exists variant_exposures_branch_id_idx
  on variant_exposures(branch_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references apps(id) on delete cascade,
  actor text not null,
  event text not null,
  resource_type text,
  resource_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_app_created_at_idx
  on audit_logs(app_id, created_at);

create index if not exists audit_logs_resource_idx
  on audit_logs(resource_type, resource_id);

create table if not exists eval_reports (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references apps(id) on delete cascade,
  branch_id uuid references evo_branches(id) on delete set null,
  pr_url text,
  status text not null,
  checks jsonb not null,
  recommendation text,
  created_at timestamptz not null default now()
);

create index if not exists eval_reports_branch_id_idx
  on eval_reports(branch_id);
