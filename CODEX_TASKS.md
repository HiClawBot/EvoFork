# Codex 施工任务清单

本文件用于逐条投喂 Codex。不要一次性要求实现全部系统。

每个任务都要求 Codex：

1. 先阅读 `AGENTS.md`、`README.md`、`CONSTRUCTION.md`。
2. 只完成当前任务。
3. 新增测试。
4. 运行相关验证命令。
5. 输出变更摘要、测试结果和后续建议。

---

## Task 0 - 初始化仓库骨架

```text
Read AGENTS.md, README.md, CONSTRUCTION.md, and MVP_SPEC.md.
Initialize the EvoFork monorepo using TypeScript and pnpm workspaces.
Create the directory structure described in README.md and CONSTRUCTION.md.
Add root package scripts for build, dev, test, typecheck, lint, and evo.
Add placeholder packages and services with minimal buildable TypeScript entrypoints.
Do not implement business logic yet.
Add a basic CI workflow that runs install, build, typecheck, and test.
Acceptance: pnpm install, pnpm build, pnpm test, and pnpm typecheck pass.
```

---

## Task 1 - Manifest parser

```text
Implement packages/manifest-parser.
It must read evo.manifest.yaml, validate it with Zod, expose TypeScript types, and provide functions:
- loadManifest(path)
- validateManifest(input)
- listSurfaces(manifest)
- findSurface(manifest, surfaceId)
- assertSurfacePathAllowed(manifest, surfaceId, changedFiles)
Add tests for valid manifest, duplicate surface ids, missing required fields, and unauthorized paths.
Acceptance: tests pass and the example manifest validates.
```

---

## Task 2 - CLI manifest commands

```text
Implement packages/cli with commands:
- evo manifest validate
- evo surface list
- evo surface explain <surfaceId>
Use the manifest-parser package.
Add useful terminal output and non-zero exit codes on validation failure.
Acceptance: commands work against evo.manifest.example.yaml.
```

---

## Task 3 - SDK core

```text
Implement packages/sdk-core.
Expose an EvoClient with:
- feedback(input)
- track(event, properties)
- getVariant(surfaceId, context)
The client must accept endpoint, appId, apiKey optional, timeoutMs optional.
Network failures must not throw by default for feedback/track; they should return a safe result.
getVariant should return default on failure unless strict mode is enabled.
Add tests with mocked fetch.
```

---

## Task 4 - React SDK

```text
Implement packages/sdk-react.
Expose:
- EvoProvider
- useEvoClient
- useEvoVariant
- EvoSlot
The SDK must support fallback rendering when no variant is available.
Add a simple test or example component.
Do not depend on the demo app.
```

---

## Task 5 - API server skeleton

```text
Implement services/api-server using Fastify.
Add health endpoint GET /health.
Add versioned route prefix /v1.
Add request validation with Zod.
Add basic error handling.
Add tests for /health and validation errors.
Do not add authentication yet; leave TODO comments for auth middleware.
```

---

## Task 6 - Signal Hub

```text
Implement Signal Hub endpoints in services/api-server:
- POST /v1/signals
- POST /v1/feedback
- POST /v1/support-summaries
- GET /v1/surfaces/:surfaceId/signals
Use an in-memory repository first if database setup is not ready, but isolate it behind an interface.
Support summaries must include piiRemoved. If piiRemoved is false, mark the signal as not eligible for LLM use.
Add tests for each endpoint.
```

---

## Task 7 - Database layer

```text
Add PostgreSQL support with Prisma or Drizzle.
Create tables for:
- apps
- feedback_signals
- rfcs
- evo_branches
- variant_exposures
- audit_logs
Keep repository interfaces so tests can use in-memory implementations.
Add migration scripts and documentation.
Acceptance: local docker compose can start postgres and run migrations.
```

---

## Task 8 - Mock LLM adapter

```text
Implement adapters/llm-mock.
Given feedback for pricing.hero, it should return a deterministic RFC about pricing clarity.
This adapter enables the demo without real API keys.
Add tests.
```

---

## Task 9 - OpenAI-compatible LLM adapter

```text
Implement adapters/llm-openai-compatible.
It should use an OpenAI-compatible chat or responses endpoint configured via environment variables.
Do not hardcode provider names, model names, or API keys.
Add schema validation for model outputs.
Add tests using mocked HTTP responses.
```

---

## Task 10 - Insight/RFC Agent

```text
Implement services/insight-worker or an equivalent module that generates RFCs from feedback signals.
Inputs: appId, surfaceId, manifest surface, recent signals.
Output: structured RFC matching docs/API_SPEC.md.
Use mock LLM by default.
Store generated RFCs and write audit logs.
Add CLI command: evo insight generate --surface <surfaceId>.
Acceptance: demo feedback can generate an RFC.
```

---

## Task 11 - Patch boundary checker

```text
Implement services/patch-agent boundary checking.
Given a git diff, manifest, and surfaceId, detect changed files and reject any file outside the allowed surface path.
Also reject configured forbidden path patterns.
Add tests with valid and invalid diffs.
Do not call GitHub yet.
```

---

## Task 12 - Patch Agent PR generation

```text
Implement Patch Agent PR generation flow.
Given an RFC and surface, generate a branch name, a patch, and a PR body.
For v0.1, use a safe deterministic patch for the demo pricing hero when mock mode is enabled.
Wire in the GitHub adapter behind an interface.
Do not merge PRs.
Acceptance: create-pr command can produce a patch and PR body locally even without GitHub credentials.
```

---

## Task 13 - GitHub adapter

```text
Implement adapters/github using Octokit.
Functions:
- createBranch
- commitFiles
- createPullRequest
- commentOnPullRequest
All functions must be mockable.
Do not log tokens.
Add tests with mocked Octokit.
```

---

## Task 14 - Eval Gate

```text
Implement eval-gate CLI commands:
- evo eval patch-boundary
- evo eval security
- evo eval report
Add GitHub Actions workflow .github/workflows/evofork-eval.yml.
The report should output JSON.
Acceptance: unauthorized path changes fail the patch-boundary command.
```

---

## Task 15 - Branch Registry

```text
Implement Branch Registry endpoints:
- GET /v1/branches
- POST /v1/branches
- GET /v1/branches/:id
- POST /v1/branches/:id/approve
- POST /v1/branches/:id/rollout
- POST /v1/branches/:id/revert
- POST /v1/branches/:id/sunset
Enforce state transitions.
Write audit logs.
Add tests.
```

---

## Task 16 - Router

```text
Implement Router endpoint POST /v1/variants/resolve.
It must select active/canary branches by surface, segment match, rollout percentage, and sticky hash.
It must return default when user opted out.
Add stableHash implementation with tests.
Acceptance: same userId and branchId always produce same rollout decision.
```

---

## Task 17 - Admin Console

```text
Implement apps/admin-console with pages:
- Dashboard
- Surfaces
- Feedback
- RFCs
- Branches
- Audit Logs
Use simple server-side or client-side data fetching from the API server.
Do not over-design UI.
Acceptance: a maintainer can view feedback, generate RFC, view branches, and revert a branch.
```

---

## Task 18 - Demo Next.js app

```text
Implement apps/demo-nextjs.
Create /pricing page with EvoFork SDK integration.
Include feedback submission UI.
Include default PricingHero and at least one variant component.
The app should run locally with mock API and mock LLM.
Acceptance: feedback -> RFC -> branch -> route can be demonstrated locally.
```

---

## Task 19 - OpenFeature provider

```text
Implement packages/openfeature-provider.
Expose EvoForkProvider that resolves feature flag values by calling /v1/variants/resolve.
Add a small usage example.
Add tests with mocked API responses.
```

---

## Task 20 - OpenTelemetry adapter

```text
Implement adapters/opentelemetry.
Emit metrics/logs for:
- variant_exposed
- feedback_submitted
- branch_rollout_changed
- branch_reverted
Keep this optional and disabled by default.
Add docs.
```

---

## Task 21 - v0.1 release hardening

```text
Prepare v0.1 Developer Preview release.
Ensure:
- README quickstart works
- pnpm build passes
- pnpm test passes
- pnpm typecheck passes
- demo works without production credentials
- SECURITY.md is accurate
- LICENSE exists
- release notes exist
Create CHANGELOG.md with v0.1.0 entry.
```
