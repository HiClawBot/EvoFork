# EvoFork Scenario Models

This package contains versioned application scenario fixtures used by the public
website and future scenario-player demos.

```bash
pnpm --filter @evofork/scenarios build
pnpm --filter @evofork/scenarios test
```

The first fixtures cover:

- `pricing.hero`
- `docs.quickstart`
- `support.refund_policy_answer`

Each scenario keeps feedback as data, ties the demo to a manifest-style surface,
and records allowed and blocked change categories.

## 中文

本包包含公开官网和后续 scenario player demo 使用的版本化应用场景 fixtures。

```bash
pnpm --filter @evofork/scenarios build
pnpm --filter @evofork/scenarios test
```

首批 fixtures 覆盖：

- `pricing.hero`
- `docs.quickstart`
- `support.refund_policy_answer`

每个场景都把用户反馈视为数据，绑定 manifest 风格的 surface，并记录允许与阻止的变更类别。
