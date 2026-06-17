# EvoFork Policy Engine

## English

The Policy Engine is the first v0.2 governance component. It turns manifest
constraints into an auditable allow/block decision before a patch or rollout is
accepted.

It checks:

- the action is tied to a known manifest surface
- requested change categories are listed in `allowed_changes`
- forbidden categories such as payment, auth, legal, privacy, pricing amount,
  and database schema changes are blocked by default
- rollout percentages stay inside the surface `max_auto_percentage`
- surfaces that require human approval are not rolled out without approval

CLI examples:

```bash
pnpm evo policy check --surface pricing.hero --change copy --json
pnpm evo policy check --surface pricing.hero --change payment_logic --json
pnpm evo policy check --surface pricing.hero --rollout 10 --approved --json
```

The v0.2.0 policy engine is intentionally small. It is not an enterprise
permission system, and it does not merge, deploy, or override Eval Gate.

## 中文

Policy Engine 是 v0.2 的第一个治理组件。它把 manifest 约束转换为可审计的
allow/block 决策，用于在 patch 或 rollout 被接受前做安全判断。

它会检查：

- action 必须关联到已知 manifest surface
- 请求的 change category 必须出现在 `allowed_changes`
- 支付、认证、法律、隐私、价格金额和数据库 schema 等禁止类别默认阻断
- rollout percentage 不能超过 surface 的 `max_auto_percentage`
- 需要人工审批的 surface 不能在未审批时 rollout

CLI 示例：

```bash
pnpm evo policy check --surface pricing.hero --change copy --json
pnpm evo policy check --surface pricing.hero --change payment_logic --json
pnpm evo policy check --surface pricing.hero --rollout 10 --approved --json
```

v0.2.0 的 Policy Engine 刻意保持很小。它不是企业权限系统，也不会合并、
部署或绕过 Eval Gate。
