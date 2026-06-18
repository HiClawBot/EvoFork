# Scenario Models

EvoFork scenario models are versioned fixtures that describe how a surface can
evolve in a safe demo.

The first package is `@evofork/scenarios` in `examples/scenarios`.

```bash
pnpm --filter @evofork/scenarios build
pnpm --filter @evofork/scenarios test
```

The fixtures are intentionally small and reviewable:

- `pricing.hero`
- `docs.quickstart`
- `support.refund_policy_answer`

Each model includes:

- localized title, audience, problem, and signal examples
- manifest-style `surfaceId`, `surfaceType`, and branch name
- allowed and blocked change categories
- primary and guardrail metrics
- demo flow steps for signal, RFC, Eval Gate, and routing

The public website build reads these fixtures and writes
`apps/website/dist/assets/scenarios.json`. The browser UI renders from that JSON,
so the website and examples share the same scenario source.

The website Scenario Player uses only public-safe fixture fields:

- localized title, audience, problem, signal examples, and demo steps
- surface id, surface type, and branch name
- allowed and blocked change categories
- primary and guardrail metrics
- Eval Gate summary

Scenario models do not grant patch permissions by themselves. Manifest surfaces
still define the allowed file boundary, and Eval Gate still enforces policy.

## 中文

EvoFork scenario model 是版本化 fixture，用来描述某个 surface 如何在安全 demo
中演化。

首个包位于 `examples/scenarios`，包名为 `@evofork/scenarios`。

```bash
pnpm --filter @evofork/scenarios build
pnpm --filter @evofork/scenarios test
```

首批 fixtures 保持小而可审查：

- `pricing.hero`
- `docs.quickstart`
- `support.refund_policy_answer`

每个模型包含：

- 双语 title、audience、problem 和 signal examples
- manifest 风格的 `surfaceId`、`surfaceType` 和 branch name
- 允许与阻止的变更类别
- 主指标和 guardrail 指标
- signal、RFC、Eval Gate、routing 的 demo flow steps

公开官网构建时会读取这些 fixtures，并写出
`apps/website/dist/assets/scenarios.json`。浏览器 UI 从该 JSON 渲染，因此官网和
examples 共享同一个场景来源。

官网 Scenario Player 只使用适合公开展示的 fixture 字段：

- 双语 title、audience、problem、signal examples 和 demo steps
- surface id、surface type 和 branch name
- 允许与阻止的变更类别
- 主指标和 guardrail 指标
- Eval Gate 摘要

Scenario model 本身不会授予 patch 权限。Manifest surface 仍然定义允许的文件边界，
Eval Gate 仍然负责执行 policy。
