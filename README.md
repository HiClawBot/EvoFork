# EvoFork

[English](#english) | [中文](#中文)

## English

**EvoFork** is an open-source framework for building self-evolving applications.

It turns user feedback, support intelligence, and product metrics into safe, auditable, testable version forks.

> Feedback to Fork. Fork to Learning. Learning to Safer Software.

---

## What EvoFork does

EvoFork helps applications evolve through a controlled loop:

```text
Feedback -> Insight -> RFC -> Pull Request -> Eval Gate -> Version Fork -> Segment Routing -> Observability -> Rollback or Promotion
```

It enables:

- collecting product feedback from apps
- ingesting AI customer support summaries
- detecting user friction with LLMs
- generating structured product RFCs
- creating constrained pull requests
- registering version forks
- routing variants to user segments
- observing branch performance
- rolling back unsafe or underperforming changes

---

## What EvoFork does not do

EvoFork is intentionally not a black-box auto-coding system.

It does not:

- let AI freely edit your production system
- bypass tests, reviews, or governance
- auto-deploy risky changes
- fork code per individual user
- change payment, auth, legal, privacy, or database logic without explicit approval
- treat user feedback as trusted instructions

---

## Status

```text
Project status: v0.3 Developer Preview
Primary language: TypeScript
Initial target: Next.js + Node.js applications
License: Apache-2.0
```

v0.3 is a local-first developer preview. It includes the minimal trusted loop,
initial governance policy checks, and deterministic canary observation, with
mock/local adapters so the demo runs without production LLM, GitHub, database,
or deployment credentials.

---

## Core concepts

### Surface

A surface is a part of an application that may evolve.

Examples:

```text
pricing.hero
onboarding.signup
admin.bulk_import
support.refund_policy_answer
docs.quickstart
```

### Manifest

The manifest tells EvoFork what AI is allowed to change.

```yaml
app:
  id: demo-saas
  name: Demo SaaS
  default_branch: main

surfaces:
  - id: pricing.hero
    type: react-component
    path: apps/demo-nextjs/src/app/pricing/PricingHero.tsx
    owner: growth-team
    allowed_changes:
      - copy
      - layout
      - cta_text
    forbidden_changes:
      - payment_logic
      - authentication
      - database_schema
      - pricing_amount
    target_metrics:
      primary: pricing_to_signup_conversion
      guardrails:
        - page_error_rate
        - support_ticket_rate
        - p95_latency
    rollout:
      max_auto_percentage: 5
      require_human_approval: true
```

### Branch

A branch is a governed version fork of a surface.

```text
pricing.hero.new-user-clarity.v1
pricing.hero.developer-focused.v1
onboarding.signup.mobile-ja.v1
```

### Router

The router decides which variant a user should see.

```json
{
  "surfaceId": "pricing.hero",
  "variant": "pricing.hero.new-user-clarity.v1",
  "reason": "matched_segment_and_rollout",
  "sticky": true
}
```

---

## Architecture

```mermaid
flowchart TD
    A[Application SDK] --> B[Signal Hub]
    C[AI Support Summaries] --> B
    B --> D[Insight/RFC Agent]
    D --> E[Patch Agent]
    E --> F[GitHub Pull Request]
    F --> G[Eval Gate]
    G --> H[Branch Registry]
    H --> I[Router]
    I --> A
    A --> J[Observability Adapter]
    J --> B
```

---

## Repository structure

```text
evofork/
├── packages/
│   ├── sdk-core/
│   ├── sdk-react/
│   ├── sdk-node/
│   ├── openfeature-provider/
│   ├── manifest-parser/
│   └── db/
├── services/
│   ├── api-server/
│   ├── signal-hub/
│   ├── insight-worker/
│   ├── patch-agent/
│   ├── eval-gate/
│   ├── branch-registry/
│   ├── rollout-observer/
│   └── router/
├── apps/
│   ├── admin-console/
│   └── demo-nextjs/
├── adapters/
│   ├── llm-openai-compatible/
│   ├── llm-local/
│   ├── github/
│   ├── opentelemetry/
│   └── argo-rollouts/
├── docs/
├── examples/
└── .github/
```

---

## Quick Start

Install and validate the workspace:

```bash
pnpm install
pnpm verify
```

Validate the manifest and inspect the demo surface:

```bash
pnpm evo manifest validate
pnpm evo surface list
pnpm evo surface explain pricing.hero
```

Generate a mock RFC and local PR preview:

```bash
pnpm evo demo seed
pnpm evo insight generate --surface pricing.hero
pnpm evo patch create-pr --rfc rfc_pricing_clarity_001 --surface pricing.hero
```

Run Eval Gate and route matching locally:

```bash
pnpm evo eval report \
  --surface pricing.hero \
  --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
pnpm evo eval fixtures
pnpm evo eval fixture payment-logic-blocked --json
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user
```

Observe canary rollout health locally:

```bash
pnpm evo observe fixtures
pnpm evo observe canary --fixture healthy --json
```

Manage local branch state without production credentials:

```bash
pnpm evo branch list
pnpm evo branch create --surface pricing.hero --branch pricing.hero.local-draft.v1
pnpm evo branch approve br_local_001
pnpm evo branch rollout br_local_001 --percentage 25 --approved
pnpm evo branch revert br_demo_seed --reason "local rollback"
```

Rollout commands are checked against manifest policy before state changes. A blocked
rollout writes a local `policy_blocked` audit entry and leaves the branch rollout
unchanged.

Check governance policy decisions:

```bash
pnpm evo policy check --surface pricing.hero --change copy --json
pnpm evo policy check --surface pricing.hero --rollout 10 --approved --json
```

Run the local demo stack:

```bash
pnpm dev
```

Then open:

```text
Demo pricing page: http://127.0.0.1:3000/pricing
Admin console:     http://127.0.0.1:3001
API server:        http://127.0.0.1:3333/health
```

The local UI demo covers feedback submission, mock RFC generation, local PR/eval
preview, branch registration, segment routing, and branch revert. The Admin
Console shows governance status for data source, Eval Gate, policy audit counts,
and rollback state. The default API server uses in-memory repositories.

See [Quickstart](./docs/QUICKSTART.md) for the full local walkthrough,
[Safety Fixtures](./docs/SAFETY_FIXTURES.md) for reusable safety checks, and
[Rollout Observer](./docs/ROLLOUT_OBSERVER.md) for canary recommendations.

Optional PostgreSQL schema preview:

```bash
docker compose up -d postgres
pnpm evo db status
pnpm evo db migrate --dry-run
pnpm evo db migrate \
  --database-url "postgres://evofork:evofork_local_only@127.0.0.1:5432/evofork"
```

The database schema is available in `@evofork/db`, but the v0.3 demo still runs
without a database by default.

---

## SDK example

```tsx
import { EvoProvider, EvoSlot, useEvoVariant } from "@evofork/sdk-react";

export default function PricingPage() {
  const variant = useEvoVariant("pricing.hero", {
    userId: "user_123",
    segmentHints: {
      lifecycle_stage: "new_user",
      company_size: "1-10",
      locale: "zh-CN"
    }
  });

  return (
    <EvoProvider appId="demo-saas">
      <EvoSlot
        surface="pricing.hero"
        variant={variant}
        fallback={<DefaultPricingHero />}
      />
    </EvoProvider>
  );
}
```

Submit feedback:

```ts
evo.feedback({
  surface: "pricing.hero",
  rating: -1,
  text: "I do not understand the difference between Basic and Pro.",
  context: {
    page: "/pricing",
    lifecycle_stage: "new_user"
  },
  consent: true
});
```

---

## API Preview

```http
POST /v1/signals
POST /v1/feedback
POST /v1/support-summaries
GET  /v1/surfaces/:surfaceId/signals
GET  /v1/branches
POST /v1/branches
GET  /v1/branches/:id
POST /v1/branches/:id/approve
POST /v1/branches/:id/rollout
POST /v1/branches/:id/revert
POST /v1/branches/:id/sunset
GET  /v1/audit-logs
POST /v1/variants/resolve
POST /v1/events
```

RFC and PR generation are available through the CLI and the local admin console
in v0.3. Production GitHub writes are intentionally behind adapter boundaries
and are not invoked by default.

---

## Development roadmap

### v0.1 Developer Preview

- Manifest parser
- SDK core
- React SDK
- Signal Hub
- RFC Agent
- Patch Agent
- Eval Gate
- Branch Registry
- Router
- Demo Next.js app
- Admin Console MVP

### v0.2 Governance

- Policy engine
- Audit logs
- GitHub App
- OpenFeature provider
- OpenTelemetry adapter

### v0.3 Progressive Delivery

- Canary analysis
- Rollout health recommendations
- Argo Rollouts adapter prototype
- Branch promotion/sunset workflows
- No automatic deployment or rollback by default

---

## Documentation

- [Whitepaper](./WHITEPAPER.md)
- [Construction Guide](./CONSTRUCTION.md)
- [MVP Spec](./MVP_SPEC.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Quickstart](./docs/QUICKSTART.md)
- [Manifest Spec](./docs/MANIFEST_SPEC.md)
- [API Spec](./docs/API_SPEC.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Database](./docs/DATABASE.md)
- [Policy Engine](./docs/POLICY_ENGINE.md)
- [Safety Fixtures](./docs/SAFETY_FIXTURES.md)
- [Eval Gate](./docs/EVAL_GATE.md)
- [Rollout Observer](./docs/ROLLOUT_OBSERVER.md)
- [Router](./docs/ROUTER.md)
- [Release Checklist](./docs/RELEASE_CHECKLIST.md)
- [Codex Tasks](./CODEX_TASKS.md)
- [Security](./SECURITY.md)

---

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening pull requests.

All AI-generated changes must:

- reference a manifest surface
- include tests or explain why tests are not applicable
- include an eval report when behavior changes
- avoid unauthorized paths
- avoid secrets and production credentials

---

## License

Apache-2.0. See [LICENSE](./LICENSE).

---

## 中文

**EvoFork** 是一个用于构建自进化应用的开源框架。

它把用户反馈、客服智能摘要和产品指标转化为安全、可审计、可测试的版本分叉。

> Feedback to Fork. Fork to Learning. Learning to Safer Software.

---

## EvoFork 能做什么

EvoFork 通过受控闭环帮助应用持续演化：

```text
Feedback -> Insight -> RFC -> Pull Request -> Eval Gate -> Version Fork -> Segment Routing -> Observability -> Rollback or Promotion
```

它支持：

- 从应用中收集产品反馈
- 接入 AI 客服摘要
- 识别用户使用阻塞点
- 生成结构化产品 RFC
- 创建受约束的 PR 预览
- 注册版本分叉
- 按用户分群路由不同版本
- 观测分支效果
- 回滚不安全或效果不佳的变更

---

## EvoFork 不做什么

EvoFork 不是黑盒自动写码系统。

它不会：

- 允许 AI 任意编辑生产系统
- 绕过测试、评审或治理流程
- 自动部署高风险变更
- 为每个用户创建代码级 fork
- 在没有明确批准时修改支付、认证、法律、隐私或数据库逻辑
- 把用户反馈当成可信指令执行

---

## 状态

```text
项目状态：v0.3 Developer Preview
主要语言：TypeScript
初始目标：Next.js + Node.js 应用
许可证：Apache-2.0
```

v0.3 是本地优先的开发者预览版，包含最小可信闭环、初始治理 policy 校验和
确定性的 canary 观测。它使用 mock/local adapter，因此本地演示不需要生产
LLM、GitHub、数据库或部署凭证。

---

## 核心概念

### Surface

Surface 是应用中允许演化的一个区域。

示例：

```text
pricing.hero
onboarding.signup
admin.bulk_import
support.refund_policy_answer
docs.quickstart
```

### Manifest

Manifest 定义 EvoFork 允许 AI 修改什么。

```yaml
app:
  id: demo-saas
  name: Demo SaaS
  default_branch: main

surfaces:
  - id: pricing.hero
    type: react-component
    path: apps/demo-nextjs/src/app/pricing/PricingHero.tsx
    owner: growth-team
    allowed_changes:
      - copy
      - layout
      - cta_text
    forbidden_changes:
      - payment_logic
      - authentication
      - database_schema
      - pricing_amount
    target_metrics:
      primary: pricing_to_signup_conversion
      guardrails:
        - page_error_rate
        - support_ticket_rate
        - p95_latency
    rollout:
      max_auto_percentage: 5
      require_human_approval: true
```

### Branch

Branch 是某个 surface 的受治理版本分叉。

```text
pricing.hero.new-user-clarity.v1
pricing.hero.developer-focused.v1
onboarding.signup.mobile-ja.v1
```

### Router

Router 决定用户看到哪个变体。

```json
{
  "surfaceId": "pricing.hero",
  "variant": "pricing.hero.new-user-clarity.v1",
  "reason": "matched_segment_and_rollout",
  "sticky": true
}
```

---

## 仓库结构

```text
evofork/
├── packages/
├── services/
├── apps/
├── adapters/
├── docs/
├── examples/
└── .github/
```

---

## 快速开始

安装依赖并验证工作区：

```bash
pnpm install
pnpm verify
```

验证 manifest 并查看 demo surface：

```bash
pnpm evo manifest validate
pnpm evo surface list
pnpm evo surface explain pricing.hero
```

生成 mock RFC 和本地 PR 预览：

```bash
pnpm evo demo seed
pnpm evo insight generate --surface pricing.hero
pnpm evo patch create-pr --rfc rfc_pricing_clarity_001 --surface pricing.hero
```

本地运行 Eval Gate 和路由测试：

```bash
pnpm evo eval report \
  --surface pricing.hero \
  --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
pnpm evo eval fixtures
pnpm evo eval fixture payment-logic-blocked --json
pnpm evo route test pricing.hero \
  --user user_123 \
  --segment lifecycle_stage=new_user
```

本地观测 canary rollout 健康状态：

```bash
pnpm evo observe fixtures
pnpm evo observe canary --fixture healthy --json
```

不使用生产凭证也可以管理本地 branch 状态：

```bash
pnpm evo branch list
pnpm evo branch create --surface pricing.hero --branch pricing.hero.local-draft.v1
pnpm evo branch approve br_local_001
pnpm evo branch rollout br_local_001 --percentage 25 --approved
pnpm evo branch revert br_demo_seed --reason "local rollback"
```

rollout 命令会在修改 state 前执行 manifest policy 校验。被阻断的 rollout
会写入本地 `policy_blocked` audit 记录，并保持 branch rollout 不变。

检查治理 policy 决策：

```bash
pnpm evo policy check --surface pricing.hero --change copy --json
pnpm evo policy check --surface pricing.hero --rollout 10 --approved --json
```

启动本地 demo：

```bash
pnpm dev
```

然后打开：

```text
Demo pricing page: http://127.0.0.1:3000/pricing
Admin console:     http://127.0.0.1:3001
API server:        http://127.0.0.1:3333/health
```

本地 UI demo 覆盖反馈提交、mock RFC 生成、本地 PR/eval 预览、分支注册、分群路由和分支回滚。
Admin Console 会显示数据来源、Eval Gate、policy audit 计数和 rollback 状态。
默认 API server 使用内存仓库。

完整本地演示步骤见 [Quickstart](./docs/QUICKSTART.md)，可复用安全检查见
[Safety Fixtures](./docs/SAFETY_FIXTURES.md)，canary 建议见
[Rollout Observer](./docs/ROLLOUT_OBSERVER.md)。

可选 PostgreSQL schema 预览：

```bash
docker compose up -d postgres
pnpm evo db status
pnpm evo db migrate --dry-run
pnpm evo db migrate \
  --database-url "postgres://evofork:evofork_local_only@127.0.0.1:5432/evofork"
```

数据库 schema 位于 `@evofork/db`，但 v0.3 demo 默认仍不需要数据库。

---

## API 预览

```http
POST /v1/signals
POST /v1/feedback
POST /v1/support-summaries
GET  /v1/surfaces/:surfaceId/signals
GET  /v1/branches
POST /v1/branches
GET  /v1/branches/:id
POST /v1/branches/:id/approve
POST /v1/branches/:id/rollout
POST /v1/branches/:id/revert
POST /v1/branches/:id/sunset
GET  /v1/audit-logs
POST /v1/variants/resolve
POST /v1/events
```

v0.3 中，RFC 和 PR 生成通过 CLI 与本地 Admin Console 暴露。生产 GitHub 写入被放在 adapter 边界之后，默认不会调用。

---

## 开发路线图

### v0.1 Developer Preview

- Manifest parser
- SDK core
- React SDK
- Signal Hub
- RFC Agent
- Patch Agent
- Eval Gate
- Branch Registry
- Router
- Demo Next.js app
- Admin Console MVP

### v0.2 Governance

- Policy engine
- Audit logs
- GitHub App
- OpenFeature provider
- OpenTelemetry adapter

### v0.3 Progressive Delivery

- Canary analysis
- Rollout health recommendations
- Argo Rollouts adapter prototype
- Branch promotion/sunset workflows
- 默认不自动部署或回滚

---

## 文档

- [白皮书](./WHITEPAPER.md)
- [施工指南](./CONSTRUCTION.md)
- [MVP 规格](./MVP_SPEC.md)
- [架构](./docs/ARCHITECTURE.md)
- [快速开始](./docs/QUICKSTART.md)
- [Manifest 规格](./docs/MANIFEST_SPEC.md)
- [API 规格](./docs/API_SPEC.md)
- [数据模型](./docs/DATA_MODEL.md)
- [数据库](./docs/DATABASE.md)
- [Policy Engine](./docs/POLICY_ENGINE.md)
- [Safety Fixtures](./docs/SAFETY_FIXTURES.md)
- [Eval Gate](./docs/EVAL_GATE.md)
- [Rollout Observer](./docs/ROLLOUT_OBSERVER.md)
- [Router](./docs/ROUTER.md)
- [发布清单](./docs/RELEASE_CHECKLIST.md)
- [Codex 任务](./CODEX_TASKS.md)
- [安全](./SECURITY.md)

---

## 贡献

提交 PR 前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

所有 AI 生成的变更都必须：

- 关联 manifest surface
- 包含测试，或说明为什么不需要测试
- 在行为变更时包含 eval report
- 避免未授权路径
- 避免提交密钥和生产凭证

---

## 许可

Apache-2.0。详见 [LICENSE](./LICENSE)。
