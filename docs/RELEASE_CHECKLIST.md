# EvoFork v0.1 Release Checklist

Run from the repository root before publishing a GitHub release.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm evo manifest validate
```

Security and safety checks:

```bash
pnpm evo eval report --surface pricing.hero --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
pnpm evo eval patch-boundary --surface pricing.hero --changed-file apps/demo-nextjs/src/app/billing/Checkout.tsx
```

The second command must fail because the changed file is outside the manifest
surface boundary.

Local demo smoke path:

1. Run `pnpm dev`.
2. Open `http://127.0.0.1:3000/pricing`.
3. Submit pricing feedback.
4. Open `http://127.0.0.1:3001`.
5. Generate RFC.
6. Create demo branch.
7. Confirm the pricing page resolves `pricing.hero.new-user-clarity.v1`.
8. Revert the branch and confirm routing falls back to `default`.

Release notes:

- v0.1 is local-first and uses in-memory repositories.
- Mock LLM is the default RFC path.
- Production GitHub writes and deployments are not invoked by default.
- `.env`, `.next`, `.turbo`, `dist`, and local `.evofork` state must not be committed.
