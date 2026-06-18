# EvoFork Quickstart

[English](#english) | [中文](#中文)

## English

This guide runs the local EvoFork v0.3 developer loop without production LLM,
GitHub, database, observability, or deployment credentials.

Prerequisites:

- Node.js 22 or newer
- pnpm 10 or newer

## 1. Install and Verify

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs build, tests, typecheck, lint, manifest validation, and the
default Eval Gate report.

## 2. Inspect the Manifest

```bash
pnpm evo manifest validate
pnpm evo surface list
pnpm evo surface explain pricing.hero
```

The demo manifest declares `pricing.hero` as a safe surface. The Patch Agent may
only prepare changes for the file allowed by that surface.

## 3. Seed Demo Feedback

```bash
pnpm evo demo seed
```

This writes deterministic sample signals, a local branch fixture, and local
audit history to `.evofork/demo-seed.json`. The file is local run state and is
ignored by git.

Use a custom count or output path when needed:

```bash
pnpm evo demo seed --count 5 --output .evofork/pricing-seed.json
```

## 4. Generate an RFC

```bash
pnpm evo insight generate --surface pricing.hero
```

The default path uses the mock LLM adapter. Feedback is treated as data, not as
instructions.

## 5. Prepare a Local PR Preview

```bash
pnpm evo patch create-pr --rfc rfc_pricing_clarity_001 --surface pricing.hero
```

This does not call GitHub by default. It prepares local PR metadata, a branch
name, a patch preview, and a manifest boundary report.

## 6. Run Eval Gate

```bash
pnpm evo eval report \
  --surface pricing.hero \
  --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
```

The report should pass. A file outside the manifest boundary should fail:

```bash
pnpm evo eval patch-boundary \
  --surface pricing.hero \
  --changed-file apps/demo-nextjs/src/app/billing/Checkout.tsx
```

Run bundled safety fixtures:

```bash
pnpm evo eval fixtures
pnpm evo eval fixture payment-logic-blocked --json
```

Blocked fixtures return success when EvoFork blocks them as expected.

## 7. Test Routing

```bash
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user
```

Expected output:

```text
Matched branch: pricing.hero.new-user-clarity.v1
Reason: matched_segment_and_rollout
Sticky: true
```

By default, route test reads `.evofork/demo-seed.json` when present. Pass an
explicit branch fixture when needed:

```bash
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user \
  --branches .evofork/demo-seed.json
```

JSON output is available for automation:

```bash
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user \
  --json
```

Opt-out personalization always falls back to `default`:

```bash
pnpm evo route test pricing.hero --opt-out --json
```

## 8. Manage Local Branch State

The seed file can be managed without a running API server:

```bash
pnpm evo branch list
pnpm evo branch create \
  --surface pricing.hero \
  --branch pricing.hero.local-draft.v1
pnpm evo branch revert br_demo_seed --reason "local rollback"
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user \
  --json
```

After revert, routing falls back to `default`. The command also appends a local
audit log entry to `.evofork/demo-seed.json`.

For draft branch fixtures, use the same local state file to approve and roll out:

```bash
pnpm evo branch approve br_local_001 --state .evofork/demo-seed.json
pnpm evo branch rollout br_local_001 --percentage 25 --approved --state .evofork/demo-seed.json
pnpm evo branch promote br_local_001 --approved --eval-passed --state .evofork/demo-seed.json
pnpm evo branch sunset br_local_001 --state .evofork/demo-seed.json
```

Rollout, promote, and sunset commands run policy checks before changing local
state. Promotion also requires Eval Gate evidence through a passed branch eval
report or `--eval-passed`. Blocked actions write audit logs and leave branch
state unchanged.

When the API server is unavailable, the Admin Console also uses this local seed
state for demo branch creation and rollback.

## 9. Observe Canary Health

List deterministic rollout observation fixtures:

```bash
pnpm evo observe fixtures
```

Analyze a healthy canary:

```bash
pnpm evo observe canary --fixture healthy --json
```

Analyze a regression fixture:

```bash
pnpm evo observe canary --fixture regression --json
```

The regression fixture recommends `rollback` and exits with `1`. This is an
auditable recommendation only; it does not deploy, merge, or roll back anything.

Build a canary input from the local demo metric events created by
`pnpm evo demo seed`:

```bash
pnpm evo observe input \
  --surface pricing.hero \
  --branch-id br_demo_seed \
  --branch pricing.hero.new-user-clarity.v1 \
  --rollout 25 \
  --min-sample 10 \
  --json > .evofork/canary.json
pnpm evo observe canary --input .evofork/canary.json --json
```

The input builder reads local data and computes baseline/canary metric averages.
It does not send telemetry to third parties or change branch state.

## 10. Run the UI Demo

```bash
pnpm dev
```

Open:

```text
Demo pricing page: http://127.0.0.1:3000/pricing
Admin console:     http://127.0.0.1:3001
API server:        http://127.0.0.1:3333/health
```

Suggested demo path:

1. Open the pricing page.
2. Submit pricing feedback.
3. Open the Admin Console.
4. Generate an RFC.
5. Create the demo branch.
6. Confirm routing resolves `pricing.hero.new-user-clarity.v1`.
7. Confirm the Admin Console shows the Rollout Observer recommendation and
   metric rows.
8. Revert the branch.
9. Confirm routing falls back to `default`.

## Troubleshooting

- If `pnpm evo ...` cannot find the CLI dist entrypoint, run `pnpm build` first.
- If ports are already in use, stop the existing local server or change the app
  dev port before running `pnpm dev`.
- The mock LLM path does not need `OPENAI_API_KEY`.
- GitHub PR creation is not invoked by default in v0.3.
- Rollout Observer does not change production traffic or branch state.

---

## 中文

本指南用于跑通本地 EvoFork v0.3 开发者闭环，不需要生产 LLM、GitHub、数据库、观测或部署凭证。

前置要求：

- Node.js 22 或更新版本
- pnpm 10 或更新版本

## 1. 安装并验证

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` 会运行 build、test、typecheck、lint、manifest validate 和默认 Eval Gate report。

## 2. 查看 Manifest

```bash
pnpm evo manifest validate
pnpm evo surface list
pnpm evo surface explain pricing.hero
```

demo manifest 声明了安全 surface：`pricing.hero`。Patch Agent 只能为该 surface 允许的文件准备变更。

## 3. 写入 Demo Feedback

```bash
pnpm evo demo seed
```

该命令会把确定性的示例 signals、本地 branch fixture 和本地 audit history 写入
`.evofork/demo-seed.json`。这个文件属于本地运行状态，已被 git 忽略。

也可以指定数量或输出路径：

```bash
pnpm evo demo seed --count 5 --output .evofork/pricing-seed.json
```

## 4. 生成 RFC

```bash
pnpm evo insight generate --surface pricing.hero
```

默认路径使用 mock LLM adapter。用户反馈会被当成数据，而不是可执行指令。

## 5. 生成本地 PR 预览

```bash
pnpm evo patch create-pr --rfc rfc_pricing_clarity_001 --surface pricing.hero
```

该命令默认不会调用 GitHub。它会生成本地 PR metadata、branch name、patch preview 和 manifest boundary report。

## 6. 运行 Eval Gate

```bash
pnpm evo eval report \
  --surface pricing.hero \
  --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
```

该报告应通过。未授权文件应失败：

```bash
pnpm evo eval patch-boundary \
  --surface pricing.hero \
  --changed-file apps/demo-nextjs/src/app/billing/Checkout.tsx
```

运行内置 safety fixtures：

```bash
pnpm evo eval fixtures
pnpm evo eval fixture payment-logic-blocked --json
```

如果 EvoFork 按预期阻断了危险行为，被阻断的 fixture 也会返回成功。

## 7. 测试路由

```bash
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user
```

预期输出：

```text
Matched branch: pricing.hero.new-user-clarity.v1
Reason: matched_segment_and_rollout
Sticky: true
```

默认情况下，route test 会在文件存在时读取 `.evofork/demo-seed.json`。需要时也可以显式传入 branch fixture：

```bash
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user \
  --branches .evofork/demo-seed.json
```

自动化场景可以使用 JSON 输出：

```bash
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user \
  --json
```

关闭个性化时总是返回 `default`：

```bash
pnpm evo route test pricing.hero --opt-out --json
```

## 8. 管理本地 Branch 状态

不启动 API server 时，也可以直接管理 seed 文件：

```bash
pnpm evo branch list
pnpm evo branch create \
  --surface pricing.hero \
  --branch pricing.hero.local-draft.v1
pnpm evo branch revert br_demo_seed --reason "local rollback"
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user \
  --json
```

回滚后，路由会回到 `default`。该命令也会向 `.evofork/demo-seed.json` 追加本地 audit log。

对于 draft branch fixture，可以使用同一个本地状态文件进行 approve 和 rollout：

```bash
pnpm evo branch approve br_local_001 --state .evofork/demo-seed.json
pnpm evo branch rollout br_local_001 --percentage 25 --approved --state .evofork/demo-seed.json
pnpm evo branch promote br_local_001 --approved --eval-passed --state .evofork/demo-seed.json
pnpm evo branch sunset br_local_001 --state .evofork/demo-seed.json
```

rollout、promote 和 sunset 命令会在修改本地 state 前执行 policy 校验。
promotion 还需要通过已通过的 branch eval report 或 `--eval-passed` 提供
Eval Gate 证明。被阻止的动作会写入 audit log，并保持 branch state 不变。

当 API server 不可用时，Admin Console 也会使用这个本地 seed state 来创建 demo branch 和回滚 branch。

## 9. 观测 Canary 健康状态

列出确定性的 rollout observation fixtures：

```bash
pnpm evo observe fixtures
```

分析健康 canary：

```bash
pnpm evo observe canary --fixture healthy --json
```

分析回归 fixture：

```bash
pnpm evo observe canary --fixture regression --json
```

回归 fixture 会建议 `rollback` 并返回退出码 `1`。这只是可审计建议，
不会自动部署、合并或回滚任何内容。

从 `pnpm evo demo seed` 创建的本地 demo metric events 构建 canary 输入：

```bash
pnpm evo observe input \
  --surface pricing.hero \
  --branch-id br_demo_seed \
  --branch pricing.hero.new-user-clarity.v1 \
  --rollout 25 \
  --min-sample 10 \
  --json > .evofork/canary.json
pnpm evo observe canary --input .evofork/canary.json --json
```

input builder 只读取本地数据并计算 baseline/canary 指标平均值。
它不会向第三方发送遥测，也不会修改 branch state。

## 10. 运行 UI Demo

```bash
pnpm dev
```

打开：

```text
Demo pricing page: http://127.0.0.1:3000/pricing
Admin console:     http://127.0.0.1:3001
API server:        http://127.0.0.1:3333/health
```

建议演示路径：

1. 打开 pricing page。
2. 提交 pricing feedback。
3. 打开 Admin Console。
4. 生成 RFC。
5. 创建 demo branch。
6. 确认路由命中 `pricing.hero.new-user-clarity.v1`。
7. 确认 Admin Console 显示 Rollout Observer recommendation 和 metric rows。
8. 回滚该 branch。
9. 确认路由回到 `default`。

## 常见问题

- 如果 `pnpm evo ...` 找不到 CLI dist entrypoint，先运行 `pnpm build`。
- 如果端口已被占用，停止已有本地服务，或修改 dev port 后再运行 `pnpm dev`。
- mock LLM 路径不需要 `OPENAI_API_KEY`。
- v0.3 默认不会调用 GitHub 创建真实 PR。
- Rollout Observer 不会修改生产流量或 branch state。
