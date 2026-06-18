# EvoFork Website

Static bilingual website for the EvoFork public project page.

```bash
pnpm --filter @evofork/website build
pnpm --filter @evofork/website dev -- --host 127.0.0.1 --port 4173
```

The build output is written to `apps/website/dist` and is designed for GitHub
Pages deployment through `.github/workflows/pages.yml`.

The Scenario Player is generated at build time from `examples/scenarios`.
The build also stamps the visible version label from the root `package.json`.

## 中文

这是 EvoFork 的独立双语官网包。

```bash
pnpm --filter @evofork/website build
pnpm --filter @evofork/website dev -- --host 127.0.0.1 --port 4173
```

构建产物位于 `apps/website/dist`，用于通过 `.github/workflows/pages.yml`
发布到 GitHub Pages。

Scenario Player 会在构建时从 `examples/scenarios` 生成。
构建脚本也会从根目录 `package.json` 写入页面显示的版本号。
