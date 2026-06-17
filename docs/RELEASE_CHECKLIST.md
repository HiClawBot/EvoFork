# EvoFork v0.1 Release Checklist

Run from the repository root before publishing a GitHub release.

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Security and safety checks:

```bash
pnpm evo eval report --surface pricing.hero --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
pnpm evo eval patch-boundary --surface pricing.hero --changed-file apps/demo-nextjs/src/app/billing/Checkout.tsx
```

The second command must fail because the changed file is outside the manifest
surface boundary.

Local demo smoke path:

1. Run `pnpm evo demo seed`.
2. Run `pnpm evo route test pricing.hero --user user_123 --segment lifecycle_stage=new_user`.
3. Run `pnpm dev`.
4. Open `http://127.0.0.1:3000/pricing`.
5. Submit pricing feedback.
6. Open `http://127.0.0.1:3001`.
7. Confirm local seed feedback is visible if the API has no records yet.
8. Generate RFC.
9. Create demo branch.
10. Confirm the pricing page resolves `pricing.hero.new-user-clarity.v1`.
11. Revert the branch and confirm routing falls back to `default`.

Release notes:

- v0.1 is local-first and uses in-memory repositories.
- Mock LLM is the default RFC path.
- Production GitHub writes and deployments are not invoked by default.
- `.env`, `.next`, `.turbo`, `dist`, and local `.evofork` state must not be committed.
