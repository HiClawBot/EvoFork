# Multi-App Workspace

## English

EvoFork v0.4.0 hardens the local workspace format for multiple apps while
keeping the default demo credential-free.

Local JSON state now includes an `apps` index:

```json
{
  "apps": [
    {
      "id": "demo-saas",
      "defaultBranch": "main",
      "manifestPath": "evo.manifest.yaml"
    }
  ],
  "branches": [],
  "auditLogs": []
}
```

Older state files with only a top-level `appId` are still accepted. EvoFork
normalizes them into the `apps` index when it reads or writes local state.

Useful commands:

```bash
pnpm evo demo seed
pnpm evo workspace apps --json
pnpm evo branch list --app demo-saas --json
```

When the API server is configured with a manifest, request `appId` and
`surfaceId` must match that manifest. This prevents a single-manifest local
server from accidentally accepting another app's feedback, events, or branch
mutations.

The database preview remains app-scoped through `app_id` columns and indexes.
v0.4.0 adds `evofork_meta` so local migrations can expose schema metadata.

This is not an enterprise permissions system. It is local workspace hardening
for developers running multiple EvoFork-enabled apps.

---

## 中文

EvoFork v0.4.0 加强了本地 workspace 的多 app 格式，同时保持默认 demo 不需要任何生产凭证。

本地 JSON state 现在包含 `apps` 索引：

```json
{
  "apps": [
    {
      "id": "demo-saas",
      "defaultBranch": "main",
      "manifestPath": "evo.manifest.yaml"
    }
  ],
  "branches": [],
  "auditLogs": []
}
```

旧 state 文件如果只有顶层 `appId` 仍然可用。EvoFork 读取或写入本地 state 时会把它归一化到
`apps` 索引中。

常用命令：

```bash
pnpm evo demo seed
pnpm evo workspace apps --json
pnpm evo branch list --app demo-saas --json
```

当 API server 配置了 manifest 时，请求中的 `appId` 和 `surfaceId` 必须匹配该
manifest。这样可以避免单 manifest 的本地 server 意外接收另一个 app 的 feedback、event
或 branch mutation。

数据库预览仍然通过 `app_id` 字段和索引保持 app scope。v0.4.0 新增 `evofork_meta`，
用于在本地 migration 中暴露 schema metadata。

这不是企业权限系统，而是面向开发者在本地同时运行多个 EvoFork app 的 workspace hardening。
