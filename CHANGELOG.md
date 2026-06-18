# Changelog

## v0.3.5 - Argo Rollouts Dry-Run Adapter

Argo Rollouts planning is now available as a local dry-run adapter.

### Added

- `@evofork/adapter-argo-rollouts` now generates typed dry-run plans and Argo
  Rollouts JSON manifests from EvoFork branch rollout metadata.
- CLI command `evo argo plan` for reviewable local rollout planning.
- Policy-aware blocked plan output when requested rollout weight exceeds
  manifest rollout constraints without approval.
- Bilingual Argo Rollouts adapter documentation.
- Tests for adapter plan generation, blocked policy output, manifest rendering,
  and CLI integration.

### Changed

- README and release checklist document Argo dry-run planning.
- Workspace package versions are bumped to `0.3.5`.

### Notes

The Argo adapter is a local planner only. It does not connect to Kubernetes,
execute `kubectl`, write cluster state, deploy, or mutate production traffic.

## v0.3.4 - OpenTelemetry Observer Bridge

OpenTelemetry-style local metric points can now feed Rollout Observer.

### Added

- `@evofork/adapter-opentelemetry` now converts local OTel-style metric points
  into EvoFork `metric_observed` events.
- Adapter helpers can build Rollout Observer canary input and analyze a canary
  directly from local metric points.
- Bilingual OpenTelemetry adapter documentation.
- Tests for point conversion, input building, and canary analysis.

### Changed

- README, Rollout Observer docs, and release checklist document the local-only
  OTel observer bridge.
- Workspace package versions are bumped to `0.3.4`.

### Notes

This is a local bridge only. It does not start a collector, export telemetry,
send data to third parties, deploy, or mutate branch state.

## v0.3.3 - Policy-Gated Promotion and Sunset

Branch promotion and sunset now have explicit governed workflows.

### Added

- Branch Registry `promote` operation and explicit branch audit recording.
- Local CLI `evo branch promote` with manifest policy checks and Eval Gate
  evidence requirements.
- Local CLI `evo branch sunset` now records a policy decision before mutation.
- API `POST /v1/branches/:id/promote` with policy and Eval Gate checks.
- API `POST /v1/branches/:id/sunset` now requires manifest policy checks and
  writes policy audit output.
- Tests for policy-blocked promote, eval-blocked promote, successful promote,
  and policy-audited sunset.

### Changed

- README, Quickstart, API spec, and release checklist document governed
  promotion and sunset.
- Workspace package versions are bumped to `0.3.3`.

### Notes

Promotion and sunset remain governed branch state transitions. They do not
deploy, merge, or change production traffic directly.

## v0.3.2 - Local Metrics Observer Input

Rollout Observer can now build canary observation input from local metric events.

### Added

- `@evofork/signal-hub` now includes an in-memory metric event repository.
- API server `POST /v1/events` stores typed local metric events and
  `GET /v1/events` returns them for local tooling.
- SDK `track` supports an object form with `surfaceId`, `branchId`, `userId`,
  `sessionId`, and properties for local metric events.
- Rollout Observer exposes `buildCanaryInputFromMetricEvents`.
- CLI `evo observe input` builds canary input JSON from local seed state,
  event JSON files, or a local API endpoint.
- `evo demo seed` now writes deterministic demo metric events.

### Changed

- README, Quickstart, API spec, and Rollout Observer docs describe the local
  metric-event-to-canary-input flow.
- Workspace package versions are bumped to `0.3.2`.

### Notes

Metric events remain local developer-preview data. This release does not add
third-party telemetry export, automatic deployment, branch mutation, or traffic
changes.

## v0.3.1 - Admin Rollout Observer Visibility

The Admin Console now shows Rollout Observer recommendations in the local
governance view.

### Added

- Admin snapshot now includes a derived canary observation report for active or
  canary branches.
- Admin Console Rollout Observer panel with recommendation, status, sample
  size, metric rows, reasons, and audit payload summary.
- Governance panel now includes Rollout Observer status alongside data source,
  Eval Gate, policy, and rollback state.
- Tests for active-branch promote reports and early-canary hold reports.

### Changed

- README, Quickstart, Rollout Observer docs, and release checklist document the
  Admin Console canary visibility.
- Workspace package versions are bumped to `0.3.1`.

### Notes

This release is visibility-only. The Admin Console does not deploy, merge,
promote, roll back, mutate branch state from Rollout Observer, or change
production traffic.

## v0.3.0 - Rollout Observer

The first v0.3 progressive-delivery component is now available.

### Added

- `@evofork/rollout-observer` service package for deterministic canary metric analysis.
- `pnpm evo observe fixtures` and `pnpm evo observe canary` CLI commands.
- Canary fixtures for healthy, regression, and insufficient-sample rollout states.
- Bilingual Rollout Observer documentation and Quickstart coverage.

### Changed

- README status and roadmap now describe v0.3 as local-first canary observation.
- Release checklist includes a canary observation smoke check.
- Workspace package versions are bumped to `0.3.0`.

### Notes

Rollout Observer returns auditable `promote`, `hold`, or `rollback`
recommendations only. It does not deploy, merge, mutate branch state, or change
production traffic.

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
