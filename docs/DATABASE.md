# EvoFork Database

## English

EvoFork v0.1 runs locally with in-memory and JSON-backed repositories by default. The
database package is a preview of the PostgreSQL persistence layer that future API
repositories will use.

The schema lives in:

```text
packages/db/src/index.ts
packages/db/migrations/0001_initial.sql
```

Start a local PostgreSQL instance:

```bash
docker compose up -d postgres
```

Apply the initial migration:

```bash
psql "postgres://evofork:evofork_local_only@127.0.0.1:5432/evofork" \
  -f packages/db/migrations/0001_initial.sql
```

The local password in `docker-compose.yml` is for development only. Do not reuse
it in production or shared infrastructure.

The API server still uses in-memory repositories by default in v0.1. This keeps
the developer preview runnable without a database.

## 中文

EvoFork v0.1 默认使用内存仓库和 JSON 本地状态运行。数据库包是 PostgreSQL
持久化层预览，后续 API repository 会基于它逐步落地。

Schema 文件位于：

```text
packages/db/src/index.ts
packages/db/migrations/0001_initial.sql
```

启动本地 PostgreSQL：

```bash
docker compose up -d postgres
```

执行初始 migration：

```bash
psql "postgres://evofork:evofork_local_only@127.0.0.1:5432/evofork" \
  -f packages/db/migrations/0001_initial.sql
```

`docker-compose.yml` 中的本地密码只用于开发环境，不要在生产或共享基础设施中复用。

v0.1 中 API server 默认仍使用内存仓库，这样开发者预览版无需数据库也可以运行。
