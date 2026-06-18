# EvoFork v0.3 Release Checklist

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
pnpm evo observe input --surface pricing.hero --branch-id br_demo_seed --min-sample 10 --json > .evofork/canary.json
pnpm evo observe canary --input .evofork/canary.json --json
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
12. Confirm the Admin Console Rollout Observer panel shows recommendation,
    metric rows, and audit payload summary.
13. Confirm the pricing page resolves `pricing.hero.new-user-clarity.v1`.
14. Revert the branch and confirm routing falls back to `default`.

Release notes:

- v0.3 is local-first and uses in-memory repositories by default.
- Mock LLM is the default RFC path.
- Production GitHub writes and deployments are not invoked by default.
- Rollout Observer produces recommendations only and does not change production
  traffic or branch state.
- Local metric events are developer-preview input data and are not exported to
  third-party telemetry systems by default.
- `.env`, `.next`, `.turbo`, `dist`, and local `.evofork` state must not be committed.
