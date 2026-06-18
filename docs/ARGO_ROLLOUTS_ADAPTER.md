# Argo Rollouts Adapter

## English

`@evofork/adapter-argo-rollouts` turns EvoFork branch rollout metadata into an
Argo Rollouts dry-run plan.

The adapter is intentionally local-only in v0.3.5:

- it does not connect to Kubernetes
- it does not execute `kubectl`
- it does not write cluster state
- it does not deploy or change production traffic
- it returns a typed plan, JSON manifest, safety flags, and audit payload

## CLI

Generate a reviewable plan:

```bash
pnpm evo argo plan \
  --surface pricing.hero \
  --branch-id br_demo_seed \
  --branch pricing.hero.new-user-clarity.v1 \
  --weight 25 \
  --workload demo-nextjs \
  --stable-service demo-nextjs-stable \
  --canary-service demo-nextjs-canary \
  --approved \
  --json
```

If the requested weight exceeds the manifest rollout policy and approval is not
provided, the command returns a blocked plan and a non-zero exit code. The JSON
output is still reviewable.

## TypeScript

```ts
import { generateArgoRolloutDryRunPlan } from "@evofork/adapter-argo-rollouts";

const plan = generateArgoRolloutDryRunPlan({
  appId: "demo-saas",
  surfaceId: "pricing.hero",
  branchId: "br_demo_seed",
  branchName: "pricing.hero.new-user-clarity.v1",
  workloadRefName: "demo-nextjs",
  stableServiceName: "demo-nextjs-stable",
  canaryServiceName: "demo-nextjs-canary",
  canaryWeight: 25,
  maxAutoPercentage: 5,
  requireHumanApproval: true,
  humanApproved: true
});

console.log(plan.decision);
console.log(plan.manifestJson);
```

The generated manifest uses the Argo Rollouts `workloadRef` form and starts with
a canary `setWeight` step followed by a pause step for human review.

## Safety Model

The adapter returns `safety.clusterWrites: false` for every plan. Review
commands are included as text only; they are not executed by EvoFork.

Promotion, deployment, and production routing remain separate governed actions.

---

## 中文

`@evofork/adapter-argo-rollouts` 会把 EvoFork branch rollout 元数据转换为
Argo Rollouts dry-run plan。

v0.3.5 中该 adapter 明确保持 local-only：

- 不连接 Kubernetes
- 不执行 `kubectl`
- 不写入 cluster state
- 不部署，也不改变生产流量
- 只返回类型化 plan、JSON manifest、安全标记和 audit payload

## CLI

生成可审查计划：

```bash
pnpm evo argo plan \
  --surface pricing.hero \
  --branch-id br_demo_seed \
  --branch pricing.hero.new-user-clarity.v1 \
  --weight 25 \
  --workload demo-nextjs \
  --stable-service demo-nextjs-stable \
  --canary-service demo-nextjs-canary \
  --approved \
  --json
```

如果请求的 weight 超过 manifest rollout policy 且没有提供 approval，命令会返回
blocked plan，并以非零状态退出。JSON 输出仍然可以被审查。

## TypeScript

```ts
import { generateArgoRolloutDryRunPlan } from "@evofork/adapter-argo-rollouts";

const plan = generateArgoRolloutDryRunPlan({
  appId: "demo-saas",
  surfaceId: "pricing.hero",
  branchId: "br_demo_seed",
  branchName: "pricing.hero.new-user-clarity.v1",
  workloadRefName: "demo-nextjs",
  stableServiceName: "demo-nextjs-stable",
  canaryServiceName: "demo-nextjs-canary",
  canaryWeight: 25,
  maxAutoPercentage: 5,
  requireHumanApproval: true,
  humanApproved: true
});

console.log(plan.decision);
console.log(plan.manifestJson);
```

生成的 manifest 使用 Argo Rollouts 的 `workloadRef` 形式，并从 canary
`setWeight` step 开始，随后加入 pause step 供人工审查。

## 安全模型

adapter 对每个 plan 都返回 `safety.clusterWrites: false`。review commands
只是文本提示，EvoFork 不会执行它们。

promotion、deployment 和 production routing 仍然是独立的受治理动作。
