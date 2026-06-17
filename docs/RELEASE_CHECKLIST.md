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
```

The second command must fail because the changed file is outside the manifest
surface boundary.

Local demo smoke path:

1. Run `pnpm evo demo seed`.
2. Run `pnpm evo route test pricing.hero --user user_123 --segment lifecycle_stage=new_user`.
3. Run `pnpm evo observe canary --fixture healthy --json`.
4. Run `pnpm dev`.
5. Open `http://127.0.0.1:3000/pricing`.
6. Submit pricing feedback.
7. Open `http://127.0.0.1:3001`.
8. Confirm local seed feedback is visible if the API has no records yet.
9. Generate RFC.
10. Create demo branch.
11. Confirm the pricing page resolves `pricing.hero.new-user-clarity.v1`.
12. Revert the branch and confirm routing falls back to `default`.

Release notes:

- v0.3 is local-first and uses in-memory repositories by default.
- Mock LLM is the default RFC path.
- Production GitHub writes and deployments are not invoked by default.
- Rollout Observer produces recommendations only and does not change production traffic.
- `.env`, `.next`, `.turbo`, `dist`, and local `.evofork` state must not be committed.
