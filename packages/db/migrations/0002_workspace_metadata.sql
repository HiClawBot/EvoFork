create table if not exists evofork_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into evofork_meta (key, value, updated_at)
values (
  'schema_version',
  jsonb_build_object(
    'version', '0.4.0',
    'scope', 'multi-app-workspace'
  ),
  now()
)
on conflict (key) do update
set
  value = excluded.value,
  updated_at = excluded.updated_at;
