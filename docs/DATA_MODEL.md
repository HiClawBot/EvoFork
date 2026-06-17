# EvoFork Data Model

## apps

```sql
create table apps (
  id text primary key,
  name text,
  default_branch text not null,
  created_at timestamptz not null default now()
);
```

## feedback_signals

```sql
create table feedback_signals (
  id uuid primary key,
  app_id text not null,
  surface_id text not null,
  source text not null,
  signal_type text not null,
  text text,
  summary text,
  severity text,
  evidence_count integer default 1,
  segment_hints jsonb default '{}',
  pii_removed boolean default false,
  llm_eligible boolean default false,
  created_at timestamptz not null default now()
);
```

## rfcs

```sql
create table rfcs (
  id text primary key,
  app_id text not null,
  surface_id text not null,
  problem text not null,
  hypothesis text not null,
  proposed_changes jsonb not null,
  target_metric text,
  guardrail_metrics jsonb default '[]',
  risk text not null,
  status text not null default 'draft',
  evidence_refs jsonb default '[]',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## evo_branches

```sql
create table evo_branches (
  id uuid primary key,
  app_id text not null,
  surface_id text not null,
  rfc_id text,
  branch_name text not null,
  base_version text,
  git_branch text,
  commit_hash text,
  pr_url text,
  status text not null,
  target_segments jsonb default '{}',
  rollout_percentage integer default 0,
  eval_report jsonb default '{}',
  created_by text not null,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## variant_exposures

```sql
create table variant_exposures (
  id uuid primary key,
  app_id text not null,
  surface_id text not null,
  branch_id uuid,
  variant text not null,
  user_id text,
  session_id text,
  segment_hints jsonb default '{}',
  created_at timestamptz not null default now()
);
```

## audit_logs

```sql
create table audit_logs (
  id uuid primary key,
  app_id text not null,
  actor text not null,
  event text not null,
  resource_type text,
  resource_id text,
  payload jsonb default '{}',
  created_at timestamptz not null default now()
);
```

## eval_reports

```sql
create table eval_reports (
  id uuid primary key,
  app_id text not null,
  branch_id uuid,
  pr_url text,
  status text not null,
  checks jsonb not null,
  recommendation text,
  created_at timestamptz not null default now()
);
```
