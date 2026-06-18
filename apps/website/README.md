# EvoFork Website

Static bilingual website for the EvoFork public project page.

```bash
pnpm --filter @evofork/website build
pnpm --filter @evofork/website dev -- --host 127.0.0.1 --port 4173
```

The build output is written to `apps/website/dist` and is designed for GitHub
Pages deployment through `.github/workflows/pages.yml`.

Scenario previews are generated at build time from `examples/scenarios`.

## 中文

这是 EvoFork 的独立双语官网包。

```bash
pnpm --filter @evofork/website build
pnpm --filter @evofork/website dev -- --host 127.0.0.1 --port 4173
```

构建产物位于 `apps/website/dist`，用于通过 `.github/workflows/pages.yml`
发布到 GitHub Pages。

场景预览会在构建时从 `examples/scenarios` 生成。
