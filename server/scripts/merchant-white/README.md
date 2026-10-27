# 商家白色主题维护

本目录保存商家白色主题补丁与安装方式。已集成本机 8090，未提交推送；未覆盖 PHP 账号默认值、账号外观记录或浏览器存储。

## 集成文件

| 暂存文件 | 生产目标 |
| --- | --- |
| `merchant-white.js`、`merchant-white.css` | `public/merchant/` |
| `patch-white-theme.cjs` | `scripts/merchant-white/patch-white-theme.cjs` |
| `install-merchant-theme.php` | 替换 `scripts/install-merchant-theme.php`，停用旧皮肤跨标签同步安装器 |
| `generated/cache-overlay/*.js` | `public/_nuxt/`；或者由新安装器重新断言并生成后安装 |
| `generated/public-overlay/merchant/page.js` | `public/merchant/page.js`；外部商家路由适配器必须同批发布 |

`generated/compiled/` 是只含业务修改的 4 个模块，供审核，**不单独部署**。应部署包含缓存版本的完整 `cache-overlay`，避免一份页面出现两套 Vue/Pinia runtime。

业务补丁只修改四个既有模块：`entry.ef871ac3.js`、`useAiPcHomeDecorate.d01e3f4e.js`、`preferences.c317aa55.js`、`info.1b8b5679.js`。Nuxt 缓存覆盖为 223 个 JavaScript 文件；其余 219 个文件只统一本地 JavaScript 引用的查询版本。另包含 1 个外部商家适配器 `merchant/page.js`，其 2 个静态依赖和 entry 的 14 个动态入口统一使用 `mw20261023b`。manifest 的 `cacheOverlay` 与 `publicOverlay` 提供路径和 SHA256，必须一并发布。原生 Nuxt 可构建源码缺失，因此这是既有编译资源的缓存一致性处理；不新增重复版本目录。

## 中间件契约与安装顺序

1. 备份所有将替换的现有文件，包含中间件、旧安装器、入口 HTML 与模块。新 PHP 安装器在 `--apply` 时也会先完整备份模块与 HTML。
2. 复制白色引导、样式、断言补丁脚本和 PHP 安装器。由主任务修改中间件，在 `<head>` 最前按顺序输出：

   ```html
   <script>window.__MERCHANT_UI__={tenantId:实际租户整数,white:true};</script>
   <script src="/merchant/merchant-white.js?v=mw20261023b"></script>
   <link rel="stylesheet" href="/merchant/merchant-white.css?v=mw20261023b">
   ```

   引导脚本不能加 `defer` 或 `async`。再加载现有其他资源。登录页保持自己的白色入口。
3. 在项目根目录运行 `php scripts/install-merchant-theme.php`。它只在忽略目录 `.collab/local/merchant-white-build/` 生成、核验构建；检查返回 manifest。
4. 运行 `php scripts/install-merchant-theme.php --apply`。它重新断言并生成，先备份，再复制统一版本的模块和商家适配器，最后把 `public/pc/index.html` 的唯一 Nuxt entry 改为 `/_nuxt/entry.ef871ac3.js?v=mw20261023b`。适配器 URL 为 `/merchant/page.js?v=mw20261023b`。不修改中间件、数据库或商家数据。
5. 验证商家工作台、GEO、原生创作页、账号菜单与偏好页；随后验证商家→短剧/画布→商家的往返。检查无皮肤 detail/save/upload 请求、无皮肤图片/星空节点，以及所有本地模块加载 URL 均带相同版本。

根任务也可以直接复制本目录已核验的 `generated/cache-overlay`、`generated/public-overlay` 清单后更新 HTML entry；此时仍需先备份。不要仅修改 HTML entry 的版本，因为旧父模块或外部商家适配器可能继续导入无版本的 entry。

## 运行机制与保留范围

- `window.isMerchantWhite(path?)` 是所有 source/consumer 共用的唯一 gate；需要 `__MERCHANT_UI__.white===true`。
- `window.MerchantWhiteTheme.apply(path?)` 设置白色根标记。原生 Vue 路由/主题监听负责调用它，不使用 MutationObserver、轮询或拦截 Storage。
- 商家 `bl/Q0` 固定 imagine/light，`canSwitchMode=false`；外观返回经典浅色、空皮肤列表，跳过旧偏好存储、皮肤读取与保存。延迟旧请求通过原有 epoch 失效。
- `pc-skin` 与系统主题监听在商家不安装 focus、storage、matchMedia 监听，离开后按原机制恢复。旧保存值没有被覆盖。
- 头像菜单、偏好设置和资料页不渲染主题/皮肤入口；AppearancePanel、SkinEditor、HomeStarsBackdrop、PresetSkinEffects 在商家不初始化。图片背景分支也不渲染，避免继续创建 RAF、鼠标监听和皮肤媒体请求。
- 排除短剧/漫剧路径及其子路由、`/app/aigc_canvas` 及子路由，也识别 `/t/<tenant>` 前缀。独立 `aigc_short_drama:theme` 实现保持逐字节不变。未改短剧、画布的业务代码。
- 共享构建中的旧皮肤定义留给排除范围；商家不再运行或加载它们。不会删除其他页面可能引用的原有媒体文件。

## 核验与后续维护

`mw20261023b` 修复资料页和偏好页的三个条件占位。编译后的 Vue 优化挂载路径要求真正的 VNode，不能传原始 null；现在使用原生注释 VNode，并以独立 fragment block 保持每个条件分支的父级动态节点数量稳定。补丁支持把已安装的 v1/a 精确迁移为 v2/b，也支持 b 重复运行；旧结构不匹配则停止。暂存产物从部署前备份恢复，补齐未变更模块后重新构建，与直接迁移 a 的全部 223 份输出逐一一致。

`test-report.json`：14 组隔离检查通过，覆盖首帧、路由范围、旧缓存、无皮肤读写、异步竞态、监听生命周期、组件不初始化、全部入口分支、重复安装和版本图。检查了 5,353 处模块引用，4 个修改模块及外部商家适配器通过语法检查。

补丁每个精确替换均要求恰好出现一次，共 36 个断言替换；结构不匹配立即停止。重复运行不会重复插入补丁或查询参数。上游重建原生 Nuxt 后，必须重新运行断言、源范围检查和浏览器回归；不能盲目复制旧编译文件。变更本补丁时提升 `VERSION` 和引导版本，并同步更新 HTML entry、白色引导和样式缓存参数。

当前隔离测试不等同于最终 8090 浏览器验收；实际集成与浏览器验证由主任务统一完成。


## 2026-10-23 整体审计补充（当前版本 d）

当前运行版本统一为 `mw20261023d`，以上 b 为上一批历史说明。`patch-navigation-load.cjs` 在原白色主题断言之后执行：原生 CSS 预加载共享进行中的 Promise，失败只重试一次并驱逐失败缓存；全局搜索、工具卡和快捷入口统一进入新版视频剪辑。保留 `/ai/smart_clip` 的旧口播路由，不能全局替换该地址。

安装器已同步为 d，接受完整旧版本 a/b/c 或当前 d，拒绝混合路由版本。不要重跑早期暂存目录中的 b 安装器。原生 223 个 JS 及 `public/merchant/page.js`、`public/pc/index.html` 需要同批发布，白色引导元数据亦为 d。新断言支持迁移和重复运行；当前部署前备份恢复构建的输出必须与运行文件逐字节一致。CSS 契约见 `tests/merchant-css-preload.contract.cjs`。
