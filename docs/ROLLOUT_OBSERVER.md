# EvoFork Rollout Observer

[English](#english) | [中文](#中文)

## English

Rollout Observer is the first v0.3 progressive-delivery component. It evaluates
local canary metrics for a governed branch and returns a deterministic
recommendation:

- `promote`: metrics are within thresholds and sample size is sufficient
- `hold`: sample size is insufficient or a metric is in warning range
- `rollback`: a metric failed or an explicit guardrail failure was reported

It does not deploy, merge, promote, or roll back a branch automatically. The
result is an auditable decision aid for maintainers and CI.

## CLI

List bundled canary fixtures:

```bash
pnpm evo observe fixtures
pnpm evo observe fixtures --json
```

Analyze the healthy fixture:

```bash
pnpm evo observe canary --fixture healthy --json
```

Analyze a regression fixture:

```bash
pnpm evo observe canary --fixture regression --json
```

The regression command exits with `1` because it recommends `rollback`. A
`hold` recommendation exits with `0`, so CI can distinguish unsafe rollback
conditions from incomplete observation windows.

## Admin Console

The Admin Console surfaces the same local canary report in its governance view.
For active or canary demo branches, the console shows:

- recommendation and status
- sample size
- metric rows with baseline, canary, and regression percentages
- reasons
- generated audit payload summary

This view is read-only. It does not create a deployment, mutate branch state, or
change production traffic.

## Input Format

Custom inputs can be read from JSON:

```bash
pnpm evo observe canary --input .evofork/canary.json --json
```

Example:

```json
{
  "appId": "demo-saas",
  "surfaceId": "pricing.hero",
  "branchId": "br_demo_seed",
  "branchName": "pricing.hero.new-user-clarity.v1",
  "rolloutPercentage": 25,
  "sampleSize": 420,
  "minSampleSize": 100,
  "metrics": [
    {
      "name": "pricing_to_signup_conversion",
      "baseline": 0.124,
      "canary": 0.138,
      "direction": "increase"
    },
    {
      "name": "page_error_rate",
      "baseline": 0.012,
      "canary": 0.009,
      "direction": "decrease"
    }
  ]
}
```

`direction` means which direction is better for the metric. For example,
conversion should usually increase, while error rate and latency should usually
decrease.

## Safety Boundaries

- `surfaceId` must exist in the manifest.
- `appId` must match the manifest app.
- Input metrics are data, not instructions.
- Rollout Observer only returns a report and audit payload.
- Branch state changes still go through branch registry and policy checks.
- Deployment and production traffic changes remain outside this component.

## 中文

Rollout Observer 是 v0.3 的第一个渐进交付组件。它会针对受治理 branch 的本地
canary 指标生成确定性建议：

- `promote`：指标在阈值内，并且样本量足够
- `hold`：样本量不足，或某个指标进入 warning 区间
- `rollback`：某个指标失败，或显式 guardrail failure 被上报

它不会自动部署、合并、提升或回滚 branch。该结果只是给维护者和 CI 使用的
可审计决策辅助信息。

## CLI

列出内置 canary fixtures：

```bash
pnpm evo observe fixtures
pnpm evo observe fixtures --json
```

分析健康 fixture：

```bash
pnpm evo observe canary --fixture healthy --json
```

分析回归 fixture：

```bash
pnpm evo observe canary --fixture regression --json
```

回归 fixture 会返回退出码 `1`，因为它建议 `rollback`。`hold` 建议仍返回
`0`，这样 CI 可以区分不安全回滚条件和观察窗口尚不充分的情况。

## Admin Console

Admin Console 会在 governance 视图中展示同一份本地 canary report。对于
active 或 canary demo branch，控制台会展示：

- recommendation 和 status
- sample size
- 包含 baseline、canary 和 regression percentage 的 metric rows
- reasons
- 生成的 audit payload 摘要

这个视图是只读的。它不会创建部署、修改 branch state 或改变生产流量。

## 输入格式

也可以从 JSON 文件读取自定义输入：

```bash
pnpm evo observe canary --input .evofork/canary.json --json
```

示例：

```json
{
  "appId": "demo-saas",
  "surfaceId": "pricing.hero",
  "branchId": "br_demo_seed",
  "branchName": "pricing.hero.new-user-clarity.v1",
  "rolloutPercentage": 25,
  "sampleSize": 420,
  "minSampleSize": 100,
  "metrics": [
    {
      "name": "pricing_to_signup_conversion",
      "baseline": 0.124,
      "canary": 0.138,
      "direction": "increase"
    },
    {
      "name": "page_error_rate",
      "baseline": 0.012,
      "canary": 0.009,
      "direction": "decrease"
    }
  ]
}
```

`direction` 表示该指标哪个方向更好。例如 conversion 通常应上升，error rate
和 latency 通常应下降。

## 安全边界

- `surfaceId` 必须存在于 manifest。
- `appId` 必须与 manifest app 匹配。
- 输入指标是数据，不是指令。
- Rollout Observer 只返回 report 和 audit payload。
- Branch 状态变更仍需经过 branch registry 和 policy checks。
- 部署和生产流量修改不属于这个组件。
