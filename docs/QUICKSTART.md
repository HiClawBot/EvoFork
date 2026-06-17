# EvoFork Quickstart

[English](#english) | [中文](#中文)

## English

This guide runs the local EvoFork v0.1 developer loop without production LLM,
GitHub, database, or deployment credentials.

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
pnpm evo branch rollout br_local_001 --percentage 25 --state .evofork/demo-seed.json
```

When the API server is unavailable, the Admin Console also uses this local seed
state for demo branch creation and rollback.

## 9. Run the UI Demo

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
7. Revert the branch.
8. Confirm routing falls back to `default`.

## Troubleshooting

- If `pnpm evo ...` cannot find the CLI dist entrypoint, run `pnpm build` first.
- If ports are already in use, stop the existing local server or change the app
  dev port before running `pnpm dev`.
- The mock LLM path does not need `OPENAI_API_KEY`.
- GitHub PR creation is not invoked by default in v0.1.

---

## 中文

本指南用于跑通本地 EvoFork v0.1 开发者闭环，不需要生产 LLM、GitHub、数据库或部署凭证。

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
pnpm evo branch rollout br_local_001 --percentage 25 --state .evofork/demo-seed.json
```

当 API server 不可用时，Admin Console 也会使用这个本地 seed state 来创建 demo branch 和回滚 branch。

## 9. 运行 UI Demo

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
7. 回滚该 branch。
8. 确认路由回到 `default`。

## 常见问题

- 如果 `pnpm evo ...` 找不到 CLI dist entrypoint，先运行 `pnpm build`。
- 如果端口已被占用，停止已有本地服务，或修改 dev port 后再运行 `pnpm dev`。
- mock LLM 路径不需要 `OPENAI_API_KEY`。
- v0.1 默认不会调用 GitHub 创建真实 PR。
