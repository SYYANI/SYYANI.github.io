### blog

- `source/_posts`: GitHub Issue 同步生成的常规博客文章
- `../digest/content/digest`: Digest 摘要内容源，构建时会自动生成 `/digest/` 列表页和详情页

### private digest repo

- 博客仓库的部署 workflow 会额外 checkout 一个私有仓库作为 digest 内容源
- 在 `SYYANI.github.io` 仓库中配置 `Actions > Variables > DIGEST_REPOSITORY`，值例如 `SYYANI/digest-content`
- 在 `SYYANI.github.io` 仓库中配置 `Actions > Secrets > DIGEST_REPO_TOKEN`，用于读取该 private 仓库
- Hexo 构建时通过环境变量 `DIGEST_CONTENT_DIR` 读取 `content/digest` 目录
- 新的 digest 内容仓库可以直接复用 `.github/workflows/digest-content-dispatch.example.yml` 作为触发模板
- 在 digest 内容仓库中配置 `Actions > Secrets > BLOG_REBUILD_TOKEN`，用于触发博客仓库的 `repository_dispatch`
