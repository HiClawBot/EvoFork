# Public Site and GitHub Pages

EvoFork includes an independent static website in `apps/website`.

```bash
pnpm --filter @evofork/website build
pnpm --filter @evofork/website dev -- --host 127.0.0.1 --port 4173
```

The production artifact is `apps/website/dist`.

## GitHub Pages

The workflow `.github/workflows/pages.yml` builds `@evofork/website`, uploads the
static artifact, and deploys it through GitHub Pages.

Default project URL:

```text
https://hiclawbot.github.io/EvoFork/
```

The repository Pages source should be set to GitHub Actions.

## Optional Custom Domain

Recommended subdomain:

```text
evofork.aifund.com
```

DNS target:

```text
evofork.aifund.com CNAME HiClawBot.github.io
```

After DNS is configured and the domain is verified in GitHub, add a `CNAME` file
to the Pages artifact with:

```text
evofork.aifund.com
```

Do not enable the custom domain before DNS and repository domain verification are
complete. This avoids broken Pages routing and reduces domain takeover risk.

## 中文

EvoFork 在 `apps/website` 中包含独立静态官网。

```bash
pnpm --filter @evofork/website build
pnpm --filter @evofork/website dev -- --host 127.0.0.1 --port 4173
```

生产构建产物位于 `apps/website/dist`。

## GitHub Pages

`.github/workflows/pages.yml` 会构建 `@evofork/website`，上传静态产物，并通过
GitHub Pages 发布。

默认项目 URL：

```text
https://hiclawbot.github.io/EvoFork/
```

仓库 Pages source 应设置为 GitHub Actions。

## 可选自定义域名

推荐二级域名：

```text
evofork.aifund.com
```

DNS 指向：

```text
evofork.aifund.com CNAME HiClawBot.github.io
```

DNS 配置完成并在 GitHub 中验证域名后，再向 Pages 构建产物添加 `CNAME` 文件：

```text
evofork.aifund.com
```

不要在 DNS 和仓库域名验证完成前启用自定义域名。这样可以避免 Pages 路由不可用，
并降低域名接管风险。
