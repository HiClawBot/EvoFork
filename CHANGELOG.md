# Changelog

## v0.2.3 - Admin Governance Visibility

The Admin Console now surfaces governance state in the local demo loop.

### Added

- Governance status panel for data source, Eval Gate status, policy audit counts, and rollback state.
- Branch rows now preserve and display Eval Gate report summaries from local seed state.
- Audit log rows now preserve and display payload summaries.
- Tests for local seed eval report and audit payload preservation.

### Changed

- Admin Console styles now include compact status rows for governance summaries.
- README documents the updated Admin Console visibility in English and Chinese.
- Workspace package versions are bumped to `0.2.3`.

### Notes

This release improves visibility only. It does not add autonomous deployment, production permissions, or policy bypass behavior.

## v0.2.2 - Safety Fixtures

Safety fixtures are now available for release checks and CI smoke validation.

### Added

- Bundled Eval Gate safety fixtures for allowed copy, payment logic attempts, database schema attempts, and prompt-injection-shaped feedback.
- `pnpm evo eval fixtures` and `pnpm evo eval fixture <fixtureId>` CLI commands.
- Insight Worker regression test proving prompt-injection-shaped feedback remains data in the mock RFC path.
- Bilingual Safety Fixtures documentation.

### Changed

- README now links the safety fixture workflow in English and Chinese.
- Workspace package versions are bumped to `0.2.2`.

### Notes

Blocked fixtures pass when EvoFork blocks them as expected. These fixtures are a release-safety baseline, not a replacement for project-specific tests.

## v0.2.1 - Policy-Gated Rollout CLI

Local rollout commands now use the governance policy engine before changing
branch state.

### Added

- `pnpm evo branch rollout` now checks manifest rollout policy before mutating local demo state.
- Local `policy_allowed` and `policy_blocked` audit events for branch rollout attempts.
- Tests for approved rollout and blocked rollout paths.

### Changed

- README, Quickstart, and Policy Engine docs now document policy-gated rollout behavior in English and Chinese.
- Workspace package versions are bumped to `0.2.1`.

### Notes

This keeps rollout governance local and auditable. It does not add autonomous deployment or bypass human approval requirements.

## v0.2.0 - Governance Policy Engine

The first v0.2 governance component is now available.

### Added

- `@evofork/policy-engine` service package for auditable allow/block policy decisions.
- Policy checks for manifest surfaces, allowed/forbidden change categories, global high-risk categories, rollout limits, and human approval requirements.
- `pnpm evo policy check` CLI command.
- Bilingual Policy Engine documentation.

### Changed

- CLI now exposes a governance command before patch or rollout work.
- Workspace package versions are bumped to `0.2.0`.

### Notes

This is a minimal governance core, not a complex permission system. It does not merge, deploy, or override Eval Gate.

## v0.1.6 - Database Migration CLI

Database migrations can now be inspected and applied from the EvoFork CLI.

### Added

- `pnpm evo db status` for listing packaged SQL migrations.
- `pnpm evo db migrate --dry-run` for previewing migration application.
- `pnpm evo db migrate --database-url <url>` for applying migrations through local `psql`.
- Shared migration discovery helpers in `@evofork/db`.

### Changed

- `@evofork/cli` now depends on `@evofork/db` for migration metadata.
- README and database docs include the new migration CLI.
- Workspace package versions are bumped to `0.1.6`.

### Notes

The migration CLI intentionally uses the local `psql` executable and does not add a database driver to the API server. The v0.1 demo remains database-optional.

## v0.1.5 - PostgreSQL Schema Preview

The first database persistence preview is available without changing the default local demo mode.

### Added

- `@evofork/db` package with typed Drizzle PostgreSQL table definitions.
- Initial SQL migration for apps, feedback signals, RFCs, branches, variant exposures, audit logs, and eval reports.
- Local `docker-compose.yml` PostgreSQL service for migration testing.
- Bilingual database setup documentation.

### Changed

- README and data model docs now point to the optional PostgreSQL schema preview.
- Workspace package versions are bumped to `0.1.5`.

### Notes

The API server still uses in-memory repositories by default in v0.1. This release adds the persistence foundation only; it does not require PostgreSQL for the demo.

## v0.1.4 - Local Demo State Complete

Local demo state is now shared by the CLI and Admin Console.

### Added

- `pnpm evo branch create` for creating draft local branch fixtures.
- Shared local demo state adapter in `@evofork/branch-registry`.
- Admin Console create/revert actions can mutate `.evofork/demo-seed.json` when the API server is unavailable.

### Changed

- CLI branch lifecycle commands now use the shared local state adapter.
- Admin Console seed fallback now reads branch and audit state through the shared adapter.
- Quickstart documents local branch create, approve, rollout, route, and rollback.

### Notes

This release keeps local seed state as ignored developer run state. It does not add production persistence.

## v0.1.3 - Local Branch Lifecycle

Local branch lifecycle controls for the v0.1 Developer Preview.

### Added

- `pnpm evo branch list` for inspecting local branch fixtures.
- `pnpm evo branch approve`, `rollout`, `revert`, and `sunset` commands backed by `.evofork/demo-seed.json`.
- Local audit log entries for CLI branch lifecycle changes.
- Admin Console seed fallback can read audit logs from local demo seed state.

### Changed

- `pnpm evo demo seed` now writes branch audit history alongside demo signals and branch fixtures.
- Quickstart documents local branch rollback and draft branch approval/rollout.

### Notes

Branch lifecycle commands operate on local ignored run state by default. They do not call production APIs or deploy changes.

## v0.1.2 - Local Demo Persistence

Small local-demo persistence improvements for the v0.1 Developer Preview.

### Added

- `pnpm evo demo seed` now writes a branch fixture alongside demo signals.
- Admin Console snapshot can load `.evofork/demo-seed.json` when the local API has no matching demo records.
- `pnpm evo route test` can read branch fixtures from `.evofork/demo-seed.json` or an explicit `--branches <path>` file.

### Changed

- Admin Console shows when local seed data is being used.
- Route test keeps the simulated branch fallback when no local seed file exists.

### Notes

The local seed file remains run state and is still ignored by git. This release does not add production persistence.

## v0.1.1 - Hardening

Developer preview hardening for local setup, CLI demo flow, and documentation.

### Added

- Root `pnpm verify` script for release-style local validation.
- `pnpm evo demo seed` command for deterministic local demo signals.
- `pnpm evo route test` command for CLI router smoke tests.
- JSON output support for demo seed and route test commands.
- Bilingual Quickstart guide.

### Changed

- README quickstart now points to `pnpm verify`, demo seed, route test, and the full walkthrough.

### Notes

v0.1.1 keeps the same local-first safety model as v0.1.0. Production GitHub writes,
deployments, and external credentials remain disabled by default.

## v0.1.0 - Developer Preview

Initial public developer preview.

### Added

- Manifest parser
- CLI manifest, surface, insight, patch, and eval commands
- SDK core
- React SDK
- Signal Hub
- Mock LLM RFC generation
- Patch Agent boundary checker
- Local PR preview generation
- Eval Gate
- Branch Registry
- Router
- Admin Console MVP
- Next.js demo
- CI and EvoFork Eval Gate workflows

### Security

- Manifest-based patch boundaries
- Audit log events
- Feedback treated as untrusted data
- Opt-out personalization support

### Notes

v0.1 is intended for local development and demonstrations. It does not perform autonomous production deployment, merge pull requests, or require production credentials.
