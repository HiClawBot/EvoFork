# EvoFork v0.4 Release Checklist

Run from the repository root before publishing a GitHub release.

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Security and safety checks:

```bash
pnpm evo eval report --surface pricing.hero --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
pnpm evo eval patch-boundary --surface pricing.hero --changed-file apps/demo-nextjs/src/app/billing/Checkout.tsx
pnpm evo observe canary --fixture healthy --json
pnpm evo demo seed
pnpm evo workspace apps --json
pnpm evo branch list --app demo-saas --json
pnpm evo observe input --surface pricing.hero --branch-id br_demo_seed --min-sample 10 --json > .evofork/canary.json
pnpm evo observe canary --input .evofork/canary.json --json
pnpm --filter @evofork/adapter-opentelemetry test
pnpm --filter @evofork/adapter-argo-rollouts test
pnpm evo argo plan --surface pricing.hero --branch-id br_demo_seed --weight 25 --workload demo-nextjs --stable-service demo-nextjs-stable --canary-service demo-nextjs-canary --approved --json
pnpm evo branch create --surface pricing.hero --branch pricing.hero.release-check.v1 --state .evofork/release-branch.json
pnpm evo branch approve br_local_001 --state .evofork/release-branch.json
pnpm evo branch promote br_local_001 --approved --eval-passed --state .evofork/release-branch.json
pnpm evo branch sunset br_local_001 --state .evofork/release-branch.json
```

The second command must fail because the changed file is outside the manifest
surface boundary.

Local demo smoke path:

1. Run `pnpm evo demo seed`.
2. Run `pnpm evo route test pricing.hero --user user_123 --segment lifecycle_stage=new_user`.
3. Run `pnpm evo observe input --surface pricing.hero --branch-id br_demo_seed --min-sample 10 --json`.
4. Run `pnpm evo observe canary --fixture healthy --json`.
5. Run `pnpm dev`.
6. Open `http://127.0.0.1:3000/pricing`.
7. Submit pricing feedback.
8. Open `http://127.0.0.1:3001`.
9. Confirm local seed feedback is visible if the API has no records yet.
10. Generate RFC.
11. Create demo branch.
12. Promote a local canary branch only with `--approved --eval-passed`.
13. Sunset the promoted branch and confirm policy/audit records are written.
14. Confirm the Admin Console Rollout Observer panel shows recommendation,
    metric rows, and audit payload summary.
15. Confirm the pricing page resolves `pricing.hero.new-user-clarity.v1`.
16. Revert the branch and confirm routing falls back to `default`.

Release notes:

- v0.4 is local-first and uses in-memory repositories by default.
- Mock LLM is the default RFC path.
- Production GitHub writes and deployments are not invoked by default.
- Rollout Observer produces recommendations only and does not change production
  traffic or branch state.
- Local metric events are developer-preview input data and are not exported to
  third-party telemetry systems by default.
- The OpenTelemetry adapter is a local bridge only; it does not start a
  collector or export telemetry by default.
- The Argo Rollouts adapter is a local dry-run planner only; it does not
  connect to Kubernetes, execute `kubectl`, or write cluster state.
- Branch promotion and sunset remain governed local state changes with policy
  and audit records; they do not deploy or mutate production traffic directly.
- Local workspace state includes an `apps` index; branch and audit records remain
  app-scoped.
- Manifest-configured API servers reject app/surface requests outside the active
  manifest scope.
- `.env`, `.next`, `.turbo`, `dist`, and local `.evofork` state must not be committed.
