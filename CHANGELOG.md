# Changelog

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
