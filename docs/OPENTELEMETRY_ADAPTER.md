# EvoFork OpenTelemetry Adapter

[English](#english) | [中文](#中文)

## English

`@evofork/adapter-opentelemetry` is a local bridge from OpenTelemetry-style
metric points to Rollout Observer canary input.

It does not export telemetry, start a collector, or send data to third parties.
It only converts local metric points into EvoFork `metric_observed` events and
then reuses Rollout Observer analysis.

## Local Usage

```ts
import { analyzeOtelCanary } from "@evofork/adapter-opentelemetry";

const report = analyzeOtelCanary({
  appId: "demo-saas",
  surfaceId: "pricing.hero",
  branchId: "br_demo_seed",
  branchName: "pricing.hero.new-user-clarity.v1",
  rolloutPercentage: 25,
  minSampleSize: 2,
  points: [
    {
      name: "pricing_to_signup_conversion",
      value: 1,
      attributes: {
        "evofork.cohort": "canary",
        "evofork.session_id": "session_1",
        "evofork.direction": "increase"
      }
    }
  ]
});
```

## Attribute Conventions

- `evofork.cohort`: `baseline` or `canary`
- `evofork.branch_id`: branch id for canary points
- `evofork.session_id`: stable sample key
- `evofork.user_id`: optional user key
- `evofork.direction`: `increase` or `decrease`

The adapter also accepts short aliases such as `cohort`, `branchId`,
`sessionId`, `userId`, and `direction` for local fixtures.

## 中文

`@evofork/adapter-opentelemetry` 是一个本地 bridge，用于把 OpenTelemetry 风格
的 metric points 转换成 Rollout Observer canary input。

它不会导出 telemetry、启动 collector，或向第三方发送数据。它只会把本地 metric
points 转成 EvoFork `metric_observed` events，并复用 Rollout Observer 分析。

## 本地用法

```ts
import { analyzeOtelCanary } from "@evofork/adapter-opentelemetry";

const report = analyzeOtelCanary({
  appId: "demo-saas",
  surfaceId: "pricing.hero",
  branchId: "br_demo_seed",
  branchName: "pricing.hero.new-user-clarity.v1",
  rolloutPercentage: 25,
  minSampleSize: 2,
  points: [
    {
      name: "pricing_to_signup_conversion",
      value: 1,
      attributes: {
        "evofork.cohort": "canary",
        "evofork.session_id": "session_1",
        "evofork.direction": "increase"
      }
    }
  ]
});
```

## Attribute 约定

- `evofork.cohort`: `baseline` 或 `canary`
- `evofork.branch_id`: canary point 对应的 branch id
- `evofork.session_id`: 稳定 sample key
- `evofork.user_id`: 可选 user key
- `evofork.direction`: `increase` 或 `decrease`

adapter 也接受 `cohort`、`branchId`、`sessionId`、`userId`、`direction` 等短别名，
方便本地 fixtures 使用。
