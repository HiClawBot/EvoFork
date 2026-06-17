# EvoFork MVP 产品规格

## MVP 目标

在 v0.1 中证明一件事：

> 用户反馈可以被安全地转化为可审查 Pull Request 和可路由版本分叉。

## MVP 用户

### 开发者

希望把 EvoFork 接入自己的应用，收集反馈、生成 RFC、创建 PR。

### 产品经理

希望查看用户痛点、AI 生成的改进假设、实验指标。

### 维护者

希望管理分叉、审批、回滚、审计。

## MVP 场景

SaaS 价格页。

用户反馈：

```text
我看不懂基础版和专业版差在哪。
我是开发者，我只关心 API。
我们公司要权限管理、发票和审计。
```

EvoFork 生成：

```text
pricing.hero.new-user-clarity.v1
pricing.hero.developer-focused.v1
pricing.hero.enterprise-buyer.v1
```

## 必须功能

1. Manifest parser
2. SDK feedback
3. SDK getVariant
4. Signal Hub
5. RFC Agent
6. Patch Agent PR
7. Eval Gate
8. Branch Registry
9. Router
10. Admin Console
11. Demo Next.js

## 不做功能

1. 生产自动部署
2. 自动合并 PR
3. 高风险业务逻辑改动
4. 每用户代码级 fork
5. 企业 SSO
6. 多租户权限
7. 复杂计费系统

## 验收故事

### Story 1: 开发者初始化

```text
作为开发者，我可以使用仓库自带的 evo.manifest.yaml 启动本地 demo。
```

验收：

```bash
pnpm evo manifest validate
```

通过。

### Story 2: 用户提交反馈

```text
作为用户，我可以在 pricing 页面提交“看不懂套餐区别”的反馈。
```

验收：Admin Console Feedback 页面出现该反馈。

### Story 3: AI 生成 RFC

```text
作为产品经理，我可以基于 pricing.hero 反馈生成 RFC。
```

验收：RFC 包含 problem、evidence、hypothesis、proposedChanges、metrics、risk。

### Story 4: AI 生成 PR

```text
作为维护者，我可以从 RFC 生成本地 PR 预览。
```

验收：PR 只修改 manifest 允许的文件，并包含完整说明。

### Story 5: Eval Gate 阻止越权修改

```text
作为维护者，我希望 AI 不能修改未授权文件。
```

验收：故意修改 unauthorized path 时 CI 失败。

### Story 6: 分叉路由

```text
作为新用户，我会看到 new-user-clarity 版本。
```

验收：同一 userId 多次请求返回相同 variant。

### Story 7: 回滚

```text
作为维护者，我可以 revert 某个分叉。
```

验收：Router 不再返回该分叉。

## 非功能要求

- SDK 故障时不影响宿主应用。
- Router 响应 P95 小于 100ms，本地 demo 可放宽。
- 所有 API 输入使用 Zod 校验。
- 所有关键操作写 audit log。
- 无 API key 时 mock LLM 也能跑通 demo。
