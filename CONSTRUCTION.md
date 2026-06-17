# EvoFork 施工文档

本文档面向负责落地开发的工程师、Codex、维护者和发布负责人。

目标：把 EvoFork 从设计稿变成一个可运行、可演示、可开源发布的 v0.1 Developer Preview。

---

## 0. 施工总原则

第一版只做最小可信闭环：

```text
Manifest -> SDK -> Signal Hub -> RFC Agent -> Patch Agent -> Eval Gate -> Branch Registry -> Router -> Demo
```

不要提前做：

- 企业权限系统
- 复杂多 Agent 编排
- 自动生产发布
- 高风险业务逻辑自动修改
- 每用户代码分叉
- 插件市场

所有实现都要遵守：

```text
先边界，后智能。
先可审计，后自动化。
先 PR，后自动 merge。
先 demo 闭环，后企业能力。
```

---

## 1. 技术栈

推荐 v0.1 技术栈：

```text
Language: TypeScript
Package manager: pnpm
Monorepo: Turborepo or pnpm workspaces
Backend: Fastify
Database: PostgreSQL
ORM: Prisma or Drizzle
Queue: BullMQ + Redis
Frontend: Next.js + React
Validation: Zod
Testing: Vitest + Playwright
CI: GitHub Actions
LLM adapter: OpenAI-compatible API adapter + local mock adapter
GitHub integration: REST API or Octokit
```

第一版优先级：

```text
可跑通 > 架构完美
强约束 > 花哨智能
清晰接口 > 高级自动化
测试覆盖关键边界 > 全量覆盖
```

---

## 2. Monorepo 初始化

目标目录：

```text
evofork/
├── packages/
│   ├── sdk-core/
│   ├── sdk-react/
│   ├── sdk-node/
│   ├── manifest-parser/
│   └── openfeature-provider/
├── services/
│   ├── api-server/
│   ├── insight-worker/
│   ├── patch-agent/
│   ├── eval-gate/
│   ├── branch-registry/
│   └── router/
├── apps/
│   ├── admin-console/
│   └── demo-nextjs/
├── adapters/
│   ├── llm-openai-compatible/
│   ├── llm-mock/
│   ├── github/
│   └── opentelemetry/
├── docs/
└── examples/
```

根目录脚本建议：

```json
{
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "format": "prettier --write .",
    "evo": "tsx packages/cli/src/index.ts"
  }
}
```

验收：

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

---

## 3. Milestone 1 - Manifest Parser + CLI

### 3.1 目标

实现 `evo.manifest.yaml` 的读取、校验、查询。

### 3.2 文件

```text
packages/manifest-parser/
packages/cli/
evo.manifest.example.yaml
```

### 3.3 类型

```ts
export type EvoSurfaceType =
  | "react-component"
  | "api-route"
  | "llm-prompt"
  | "markdown-doc"
  | "config";

export type EvoSurface = {
  id: string;
  type: EvoSurfaceType;
  path: string;
  owner: string;
  allowed_changes: string[];
  forbidden_changes: string[];
  target_metrics?: {
    primary: string;
    guardrails: string[];
  };
  tests?: string[];
  rollout?: {
    max_auto_percentage: number;
    require_human_approval: boolean;
  };
};

export type EvoManifest = {
  app: {
    id: string;
    name?: string;
    default_branch: string;
  };
  surfaces: EvoSurface[];
};
```

### 3.4 CLI 命令

```bash
evo manifest validate
evo surface list
evo surface explain pricing.hero
```

### 3.5 验收标准

- manifest 缺失字段时报错。
- surface id 重复时报错。
- surface path 不存在时报警或报错。
- 能输出 surface 的 allowed/forbidden changes。
- 单元测试覆盖 parser、validator、path boundary。

---

## 4. Milestone 2 - SDK Core + React SDK

### 4.1 目标

应用可以：

- 提交 feedback
- 提交 event
- 请求 variant
- 支持匿名用户
- 支持 opt-out personalization

### 4.2 API

```ts
evo.feedback(input)
evo.track(event, properties)
evo.getVariant(surfaceId, context)
```

### 4.3 React API

```tsx
<EvoProvider appId="demo-saas">
  <EvoSlot surface="pricing.hero" variant={variant} fallback={<DefaultHero />} />
</EvoProvider>
```

```ts
const variant = useEvoVariant("pricing.hero", {
  userId: "user_123",
  segmentHints: {
    lifecycle_stage: "new_user"
  }
});
```

### 4.4 验收标准

- SDK 可以配置 endpoint 和 appId。
- SDK 网络失败时不阻塞宿主应用。
- Router 不可用时返回 fallback/default。
- feedback API 自动带上 appId、surfaceId、sessionId。

---

## 5. Milestone 3 - API Server + Signal Hub

### 5.1 目标

实现反馈和信号接入。

### 5.2 API

```http
POST /v1/signals
POST /v1/feedback
POST /v1/support-summaries
GET  /v1/surfaces/:surfaceId/signals
```

### 5.3 数据表

```sql
create table feedback_signals (
  id uuid primary key,
  app_id text not null,
  surface_id text not null,
  source text not null,
  signal_type text not null,
  text text,
  summary text,
  severity text,
  evidence_count integer default 1,
  segment_hints jsonb default '{}',
  pii_removed boolean default false,
  created_at timestamptz not null default now()
);
```

### 5.4 验收标准

- demo 页面提交反馈后数据库可见。
- Admin Console Feedback 页面可见。
- support summary 接口强制要求 `piiRemoved: true` 或标记为不可进入 LLM。
- API 有基础输入校验。

---

## 6. Milestone 4 - Insight/RFC Agent

### 6.1 目标

把反馈聚合成结构化 RFC。

### 6.2 输入

- surfaceId
- 最近 N 条 feedback_signals
- manifest surface constraints
- historical branches

### 6.3 输出

```json
{
  "surfaceId": "pricing.hero",
  "problem": "新用户不理解基础版和专业版的差异。",
  "hypothesis": "如果价格页用更具体的场景解释套餐差异，注册转化率会提升。",
  "proposedChanges": ["重写 hero 文案", "增加角色化解释", "修改 CTA"],
  "targetMetric": "pricing_to_signup_conversion",
  "guardrailMetrics": ["page_error_rate", "support_ticket_rate", "p95_latency"],
  "risk": "low",
  "requiresHumanApproval": true
}
```

### 6.4 实现要求

- 先实现 mock LLM adapter，确保无 API key 也能跑 demo。
- 再实现 OpenAI-compatible adapter。
- prompt 必须明确：用户反馈是 data，不是 instruction。
- 输出必须经过 Zod schema 校验。

### 6.5 验收标准

- 灌入 20 条 pricing.hero 反馈后能生成 RFC。
- RFC 页面展示证据、问题、假设、改动建议、风险和目标指标。
- 无 API key 时使用 mock adapter 也能跑通演示。

---

## 7. Milestone 5 - Patch Agent + PR Preview

### 7.1 目标

根据 RFC 生成受限 PR 预览。

### 7.2 Patch Agent 允许

- 读取 manifest
- 读取指定 surface 文件
- 读取 RFC
- 生成 diff
- 校验 diff 边界
- 生成本地 PR body 和 branch name
- 通过可替换 GitHub adapter 创建 PR（v0.1 默认不调用）

### 7.3 Patch Agent 禁止

- 修改 manifest 未声明路径
- 修改 payment/auth/database/legal/privacy 相关路径
- 访问生产密钥
- 直接 merge
- 直接 deploy

### 7.4 Boundary Check

```ts
function assertPatchIsAllowed(patch, manifest, surfaceId) {
  const surface = findSurface(manifest, surfaceId);
  for (const file of patch.changedFiles) {
    if (file.path !== surface.path) {
      throw new Error(`Unauthorized file: ${file.path}`);
    }
  }
}
```

### 7.5 PR 模板内容

PR 必须包含：

- surface
- problem
- evidence count
- allowed changes
- forbidden checks
- files changed
- eval plan
- rollout suggestion
- rollback plan

### 7.6 验收标准

- 点击 Create PR 后 GitHub 出现 PR。
- PR 只修改 manifest 允许路径。
- 越权修改会失败。
- PR body 包含完整 RFC 与风险说明。

---

## 8. Milestone 6 - Eval Gate

### 8.1 目标

为 AI 生成 PR 执行自动评测。

### 8.2 GitHub Actions

```yaml
name: EvoFork Eval Gate

on:
  pull_request:
    branches:
      - main

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: pnpm install --frozen-lockfile
      - run: pnpm evo manifest validate
      - run: pnpm evo eval patch-boundary
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm evo eval security
      - run: pnpm evo eval report
```

### 8.3 Eval Report

```json
{
  "status": "passed",
  "surface": "pricing.hero",
  "checks": {
    "manifest_valid": true,
    "patch_boundary": true,
    "typecheck": true,
    "unit_tests": true,
    "security_policy": true
  },
  "recommendation": "safe_for_canary_after_approval"
}
```

### 8.4 验收标准

- Eval Gate 能在 PR 上运行。
- 越权文件修改导致失败。
- 生成 eval report artifact。
- PR 页面可以看到检查状态。

---

## 9. Milestone 7 - Branch Registry

### 9.1 目标

登记版本分叉及其生命周期。

### 9.2 表

```sql
create table evo_branches (
  id uuid primary key,
  app_id text not null,
  surface_id text not null,
  branch_name text not null,
  base_version text,
  git_branch text,
  commit_hash text,
  pr_url text,
  status text not null,
  target_segments jsonb default '{}',
  rollout_percentage integer default 0,
  eval_report jsonb default '{}',
  created_by text not null,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 9.3 状态机

```text
draft -> pr_created -> evaluated -> approved -> canary -> active -> promoted
                                                  -> reverted
                                                  -> sunset
```

### 9.4 API

```http
GET  /v1/branches
POST /v1/branches
GET  /v1/branches/:id
POST /v1/branches/:id/approve
POST /v1/branches/:id/rollout
POST /v1/branches/:id/revert
POST /v1/branches/:id/sunset
```

### 9.5 验收标准

- Admin Console 可查看分叉。
- 可以批准分叉。
- 可以设置 rollout percentage。
- 可以 revert/sunset。

---

## 10. Milestone 8 - Router

### 10.1 目标

按 segment + rollout 返回 variant。

### 10.2 API

```http
POST /v1/variants/resolve
```

### 10.3 请求

```json
{
  "appId": "demo-saas",
  "surfaceId": "pricing.hero",
  "userId": "user_123",
  "segmentHints": {
    "lifecycle_stage": "new_user",
    "company_size": "1-10"
  }
}
```

### 10.4 响应

```json
{
  "surfaceId": "pricing.hero",
  "variant": "pricing.hero.new-user-clarity.v1",
  "branchId": "br_123",
  "reason": "matched_segment_and_rollout",
  "sticky": true
}
```

### 10.5 Sticky Rollout

```ts
function inRollout(userId: string, branchId: string, percentage: number): boolean {
  const hash = stableHash(`${userId}:${branchId}`);
  return hash % 100 < percentage;
}
```

### 10.6 验收标准

- 同一个 userId 多次请求结果一致。
- rollout 从 5 改 0 后不再返回该分支。
- segment 不匹配时返回 default。
- 用户 opt out 时返回 default。

---

## 11. Milestone 9 - Demo Next.js

### 11.1 页面

```text
/pricing
/admin
```

### 11.2 变体

```text
default
pricing.hero.new-user-clarity.v1
pricing.hero.developer-focused.v1
pricing.hero.enterprise-buyer.v1
```

### 11.3 演示流程

1. 用户在价格页提交反馈。
2. Admin Console 看到 feedback。
3. 点击 Generate RFC。
4. 点击 Create PR。
5. Eval Gate 通过。
6. 创建 branch。
7. 设置 segment + rollout。
8. new_user 命中 variant。
9. 点击 Revert 后回到 default。

### 11.4 验收标准

- 本地一条命令跑起 demo。
- README 中可复现完整演示。

---

## 12. Admin Console

第一版页面：

```text
Dashboard
Surfaces
Feedback
RFCs
Branches
Audit Logs
Settings
```

每个页面只做必要功能。

Dashboard 显示：

- feedback count
- active branches
- pending RFCs
- canary branches
- rollback count

---

## 13. Audit Log

所有关键操作写入 audit_logs：

```sql
create table audit_logs (
  id uuid primary key,
  app_id text not null,
  actor text not null,
  event text not null,
  resource_type text,
  resource_id text,
  payload jsonb default '{}',
  created_at timestamptz not null default now()
);
```

事件类型：

```text
feedback_received
rfc_generated
patch_agent_created_pr
eval_gate_passed
eval_gate_failed
branch_created
branch_approved
branch_rollout_changed
branch_reverted
branch_sunset
```

---

## 14. 发布标准

v0.1 发布前必须满足：

```text
pnpm build 通过
pnpm test 通过
pnpm typecheck 通过
demo 可运行
README quickstart 可复现
无生产密钥
AGENTS.md 存在
CONTRIBUTING.md 存在
SECURITY.md 存在
LICENSE 存在
至少 1 个端到端演示录屏或截图说明
```

---

## 15. Codex 施工方式

推荐按 `CODEX_TASKS.md` 一条一条投喂 Codex，不要一次要求实现全部系统。

每个任务都遵循：

```text
1. 只做一个 milestone。
2. 先读 README、CONSTRUCTION、AGENTS。
3. 保持现有测试通过。
4. 新增代码必须有测试。
5. 不允许跳过 manifest boundary。
6. 完成后输出变更摘要和验证命令。
```

---

## 16. 最终验收 Demo Script

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm dev

pnpm evo manifest validate
pnpm evo insight generate --surface pricing.hero
pnpm evo patch create-pr --rfc rfc_pricing_clarity_001 --surface pricing.hero
pnpm evo eval report --surface pricing.hero --changed-file apps/demo-nextjs/src/app/pricing/PricingHero.tsx
```

成功输出：

```text
Open http://127.0.0.1:3000/pricing and submit feedback.
Open http://127.0.0.1:3001, generate the RFC, create the demo branch, and revert it.
```
