# Eval Gate

Eval Gate determines whether an AI-generated change is safe to proceed.

## v0.1 checks

```text
manifest_valid
patch_boundary
typecheck
unit_tests
security_policy
```

Optional later:

```text
e2e_tests
accessibility
performance
supply_chain
llm_output_safety
```

## Patch boundary

A patch is invalid if it modifies any file outside the manifest surface path.

## Security policy

Reject changes that touch or appear to alter:

- payment logic
- authentication
- authorization
- database schema
- legal policy
- privacy policy
- secrets

## GitHub Actions

```yaml
name: EvoFork Eval Gate

on:
  pull_request:
    branches:
      - main

jobs:
  evofork-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: pnpm install --frozen-lockfile
      - run: pnpm evo manifest validate
      - run: pnpm evo eval patch-boundary
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm evo eval security
      - run: pnpm evo eval report
```

## Eval report

```json
{
  "status": "passed",
  "surface": "pricing.hero",
  "checks": {
    "manifest_valid": true,
    "patch_boundary": true,
    "typecheck": true,
    "unit_tests": true,
    "security_policy": true
  },
  "recommendation": "safe_for_canary_after_approval"
}
```

## Failure behavior

If Eval Gate fails:

- PR should be marked failed.
- Branch must not move to evaluated.
- Audit log must record failure.
- The agent may propose a fix, but cannot bypass the gate.
