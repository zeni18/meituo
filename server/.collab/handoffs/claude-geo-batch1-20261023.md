# Claude 交接：GEO 第一批（诊断 + 效果）

分支：main（每项任务完成即推送）
目标：GEO 用 ui-kit 重做，分三批（诊断 + 效果 → 内容 → 发布）。本批完成诊断、效果；内容、发布仍是旧 Semi 版。

## 改动

| 文件 | 内容 |
|---|---|
| `public/merchant/geo-v2.js` / `.css`（新） | GEO 诊断、效果整页（ui-kit 页面，key `geo`，`own: true`，接管 `/ai/geo` 的 `#diagnose` `#diagnose-records` `#diagnose-evidence` `#effect` `#effect-jobs` 和对应旧地址） |
| `public/merchant/ui-kit.js` | ROUTES 新增 `own` 模式（页面定义 `own:true` 时外壳不画面包屑、不插标题）；GEO 面包屑改名「内容」「发布」 |
| `public/merchant/nav-v2.js` | GEO 子菜单改为 诊断 / 内容 / 发布 / 效果；同页切换只改 hash，不整页刷新 |
| `public/merchant/geo-semi-loader.js` | geo-v2 接管时让位（UK_OWNS）；删掉的 11 个视图跳到「发布」；拓词库不再跳作品库（作品库已没有拓词页签，原来是死链），旧 `/ai/assets?finished=keyword` 回 GEO |
| `public/merchant/brand-v2.js` | `UK.knowledge = knowledgeDrawer`（GEO 复用 K5） |
| `public/merchant/brand-v2.css`、`geo-v2.css` | svg 上色改用 `color`（`.uk svg.uk-i` 优先级更高，`fill` 不生效，品牌页提示图标和批量导入图标之前因此发黑） |
| `MerchantPortalMiddleware.php`、`public/pc/index.html` | 注入 geo-v2，更新 ui-kit / nav-v2 / brand-v2 / 加载器版本号 `u10230300` |
| `docs/商家后台改版规范.md` | 第 7 节 own 模式、K5、第 14 节 GEO、第 16 节文件、更新记录 |

后端没改。用到的接口：merchantGeo 的 dashboard、workspaceReport、visibilityOptions、visibilityRecords、visibilityPreview、visibilityStart、workflow、workflowAction、options、generate、jobs、importResult、profile、workspaceRecords、contentSave；merchantWorkspace/brandChoices。每个 merchantGeo 请求都带 brand_id。

## 验证

- `node --check`、`php -l` 通过。
- 无头浏览器 + 按 PHP 服务返回结构写的模拟数据：诊断（有数据 / 空 / 批次进行中 / 服务未开通）、开始诊断弹窗（AI 生成问题的费用确认 → 生成 → 选平台 → 预览费用 → 确认页）、诊断记录与抽屉、人工观察列表与新增弹窗、品牌切换、知识环打开 K5、效果总览、任务与 TP；1280 / 1440 / 1920 无横向滚动、无溢出，控制台无报错。
- 加上旧 Semi 加载器实测切换：诊断 → 内容（Semi 挂上、geo-v2 卸下）→ 效果 → 发布 → 旧 `#b2b-sites` 跳 `#website` → 旧 `#jobs` 跳 `#effect-jobs` → 诊断，侧栏高亮和面包屑都对。
- **没有在真实后端跑过**：8090 登录过期。请登录后看一遍诊断和效果；「确认诊断」「确认生成」会扣 TP，测试时停在确认前。

## 对照图

`claude-geo-batch1-20261023/`：诊断、效果、开始诊断两步、诊断记录抽屉、任务与 TP。

## 待办

- 第二批「内容」：关键词（品牌词库、AI 拓词、手动拓词弹窗）、写稿（文章 Agent、爆文改写、批量）、文章库、事实素材、图片素材。
- 第三批「发布」：媒体列表（只显示国内软文 / 自媒体，R3/R6）、核对费用下单、投稿记录、收藏。
- 「定期复测」暂时引到自动化计划页，没有在诊断页单独做。
