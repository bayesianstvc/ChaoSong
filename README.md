# ChaoSong public frontend

本仓库保存宋超主页的公开静态前端。Sites 负责编辑和发布内容，GitHub Pages 承担独立阅读站点；访问静态页面不需要连接 Sites 后台数据库。

- 编辑来源：[Sites](https://chaosong.heoa-group.chatgpt.site/)
- 只读公开导出：[public-export](https://chaosong.heoa-group.chatgpt.site/api/public-export)
- Pages 目标：[ChaoSong](https://chaosong.blog/)

这些链接说明部署目标，不代表本说明已经确认首次自动同步部署成功。

## 自动同步

`.github/workflows/sync.yml` 在默认 `main` 分支运行，每小时第 **7、22、37、52 分钟（UTC）**检查公开内容，也支持在仓库 **Actions → Sync public content from Sites → Run workflow** 手动运行。手动选择 `force` 可在源内容与渲染版本没有变化时强制重建。

定时触发并非精确计时器：GitHub 高负载时可能延迟；公开仓库长期没有活动时，定时工作流可能被停用。需要立即更新时使用手动运行，并查看实际运行结果。[GitHub 定时触发说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

工作流使用 Node.js 24，执行 `npm ci` 和 `npm test`，然后读取已发布的公开导出。源 `generation` 与渲染提交版本均与线上 `release.json` 相同且没有开启 `force` 时，不构建新站点、不上传 Pages artifact，也不执行部署。线上 release 信息暂时不可用时会重新构建候选，并不会仅因为比较失败就改用旧数据库快照。

媒体缓存位于 `.cache/media`，固定公开设计素材位于 `.cache/static`。构建机直接从已公开的 Sites 下载，只发布本轮引用的静态成果。缓存读取与保存分开，只有完成新候选时才按 generation 保存，避免每次无变化检查都新增一份缓存。使用官方 `actions/cache/restore@v5` 和 `actions/cache/save@v5`，二者运行于 Node.js 24。[官方 v5 定义](https://github.com/actions/cache/tree/v5)

## 发布与失败处理

每轮候选生成到独立 `.build/build-<timestamp>/site`。页面、媒体、中文路由和 RSC payload 通过静态检查后，工作流只上传该轮 `artifact_path`。文件总量还须满足脚本中的 800 MB 发布预算。

公开契约验证、测试、下载、构建或发布前核验失败时，工作流不会进入 Pages 部署步骤，原线上版本继续提供服务。修复问题后可手动重跑，或等待下一次定时检查。若已进入 GitHub 部署步骤后才报错，应查看 Pages 的实际部署状态，不能只凭 Actions 的失败标记判断线上版本。

上传候选后，工作流再次运行 `node tools/sync-public-site.mjs --verify-current`。Sites 在构建或上传期间发生更新时，旧候选会被拒绝部署。最后一次检查与 GitHub 实际切换之间仍存在短暂竞态窗口；这里没有跨平台原子锁，随后一次成功同步会再次对齐最新公开内容。

首次手动发布与之后的定时同步共用本工作流和 `github-pages` concurrency group，且 `cancel-in-progress: false`，避免主动中断正在发布的任务。不会通过旧静态候选覆盖新的已发布内容。

## 本地构建与文件边界

安装 Node.js 24 后，在仓库根目录运行：

```text
npm ci
npm test
node tools/sync-public-site.mjs
```

脚本需要能访问公开导出和公开媒体，但不需要 Sites 后台凭据。成功候选的位置记录在 `.build/latest-preview.json`。本地执行只生成成果，不会自动向 GitHub 推送或部署。

`frontend/` 是公开渲染代码和固定素材清单；`tools/` 验证公开契约、同步媒体并构建静态站点。不要提交 `.build/`、`.cache/`、旧 `frontend/assets/`、凭据、生产完整备份、后台数据库、草稿、回收站或修订记录。

历史微信图的放大链接曾误导入 GitHub 文件浏览页面。同步器只在原损坏链接和正文中正确 PNG 都以精确身份、SHA-256 和大小存在于当前公开快照时，把该放大链接映射到同一张当前 PNG；任一对象删除或变化都不会用旧文件补回。原生产对象保持不变，实际修正在 `release.json` 中记录。

## 首次启用与尚待实测

仓库 Pages 的构建来源应设为 **GitHub Actions**，允许 Actions 运行，且默认分支为 `main`。同步源必须已提供兼容的 `formatVersion: 1` 与 `rendererContractVersion: 1` 公开导出。

本说明未代替以下验收：首次定时触发成功、真实缓存复用、一次 Sites 内容更新后的端到端同步，以及无变化时实际跳过部署。应以仓库 Actions 运行记录、Pages 部署记录和线上 `release.json` 为证据。自定义域名与中国大陆不同网络的可访问性也需要单独确认。

## 自定义域名

正式站点为 https://chaosong.blog/，默认从根目录构建（空 basePath），页面、媒体、CSS、JavaScript 与发布核验均使用该域名。不要在生产工作流设置旧仓库前缀。STATIC_BASE_PATH 仅供明确需要子目录的本地构建使用。
