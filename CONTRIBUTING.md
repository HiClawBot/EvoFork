# Contributing to EvoFork

Thank you for helping build EvoFork.

## Development setup

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Before opening a PR

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## PR requirements

Every PR should include:

- summary
- motivation
- tests run
- risks
- screenshots when UI changes
- docs updates when public behavior changes

## AI-generated contributions

AI-generated changes are allowed, but must follow the same review standards.

AI-generated PRs must include:

- related surface id when applicable
- manifest boundary result when applicable
- tests run
- explanation of changed files

## Scope discipline

Keep PRs small.

Do not mix unrelated changes such as:

- formatter updates
- package upgrades
- API changes
- UI rewrites
- refactors

unless the PR explicitly targets them.

## Coding style

- TypeScript first.
- Prefer explicit types at module boundaries.
- Validate external inputs.
- Keep functions small and testable.
- Avoid global mutable state.
- Avoid hidden network calls.

## Documentation

Update docs when changing:

- manifest schema
- API endpoints
- SDK methods
- router behavior
- eval gate behavior
- security boundaries

## Code of conduct

Be constructive, respectful, and specific.
