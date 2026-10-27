# 商家端主题与共享组件

## 样式入口

`MerchantPortalMiddleware.php` 仅为商家 HTML 加载：

- `public/merchant/light-theme.css`：浅色语义变量和新增业务模块的柔和卡片样式。
- `public/merchant/merchant-ui.css`：原生创作应用、资产、业务弹窗、Element/vs/新增下拉框的共用主题层。

原生主题引擎继续控制 `data-pc-design`、`data-pc-theme`、皮肤和品牌色。不要给单个页面写固定白底，也不要从打开浮层时复制计算颜色作为长期状态。共享浮层引用根节点上的 `--merchant-popup-*`，浅深及皮肤变化会重新计算，包含传送到 body 或顶层的菜单。旧资产/图片/对话组件缺失的 `--pc-theme-panel`、`--pc-theme-text-secondary`、`--ia-bg-raised` 和 `--ia-border-strong` 在此兼容。

媒体画面、照片、装修手机画布和状态色保留语义；样式规则不改这些内容。平台/OEM 管理端未加载本层样式。业务接口、生成请求和计费未改。

## 选中文字

`--merchant-selected-text` 使用实时的 `--ia-text`，选中项不把文字切换成品牌强调色。主题强调色用于柔和底色、边框、下划线、单选点和焦点环。饱和背景的主按钮、已选填充分类仍使用 `--ia-on-accent`，以保持文字对比度。禁止把整个 `--ia-accent-text` 改成普通文字色，因为业务链接与状态提示仍需要各自的语义。

新增组件的选中规则直接使用上述语义变量；共享下拉菜单和原生 Element 单选、复选、页签通过商家专用主题层统一。2026-10-16 已核对剪辑的字幕/画幅/帧率、素材分组及下拉、员工弹窗页签、装修样式及属性导航。经典深/浅和翡翠星云皮肤的选中文字跟随正常主题文字色，底色与边框继续跟随皮肤。

## 跨标签页同步

原生外观服务保存成功时会更新 `pc:appearance:v1:<tenant>:<account>` 的 localStorage。原生 `pc-skin` 插件新增存储事件监听，仅匹配当前租户/账号，调用其原有刷新函数。刷新函数的保存中/自定义预览/预设预览保护保持不变，未提交业务表单不会被页面重载。

如果覆盖了编译资源，重新安装此小补丁：

```powershell
C:/xampp/php/php.exe scripts/install-merchant-theme.php
node tests/merchant-theme-sync.contract.cjs
```

安装器幂等；原生插件结构不匹配时停止并报错，避免替换错误位置。首次已打开的旧页面需刷新载入补丁。后续同账号标签页主题变化自动同步；其他账号/租户事件忽略。

## 本次验收

- 原生图像创作下拉、数字人表单、音乐创作、AI 短视频、Agent 模型菜单、资产筛选及标签弹窗已检查。
- 新增任务抽屉及成片来源下拉、门店创建表单及状态下拉、素材话题编辑弹窗已检查。
- 保持任务抽屉和菜单打开，从另一页面切换经典浅色、经典深色、翡翠星云与冬日皮肤：背景、文字和菜单选中色同步，未提交的任务标题保留。未创建任务、门店、标签或素材，未发送通知。
- 修正原生全局输入框规则覆盖新增表单键盘焦点的问题，实际键盘 Tab 聚焦 textarea 显示当前主题的 2px 焦点环。
- 1280×720 验收页面无横向溢出，浏览器控制台无错误。共享 CSS 25 条规则全部由浏览器成功解析。
- 主题同步合约 8 项、PHP/JS 语法检查和 `git diff --check` 通过；差异检查仅有原先 `public/pc/index.html` 的换行提示。

截图位于 `runtime/local/evidence/merchant-theme/`：`task-dialog-light.jpg`、`material-dialog-light.jpg`、`native-agent-menu-light.jpg`。

## 2026-10-17 日期控件与业务页容器

- 商家 GEO、媒体发稿、任务发布、成片/图文/话题库和素材管理共用门店列表的页面底色、圆角内容容器及卡片层次；样式限定在商家业务页，素材选择弹窗保持原有布局。
- `public/shared/dates.js` 为新增业务模块的原生日期和时间字段提供中文日历。继续使用原始表单字段和本地 ISO 格式：日期 `YYYY-MM-DD`，日期时间 `YYYY-MM-DDTHH:mm`。支持手输、清除、今天、必填校验、上下界、原生 reset、动态表单销毁及弹窗内的 Esc 关闭。
- 使用本地固定版本 Flatpickr 4.6.13，无运行时 CDN。官方 npm 包的 SHA-512 完整性及 MIT 许可保存在 `public/shared/vendor/flatpickr/`。商家浮层跟随当前皮肤；OEM、代理和平台浮层跟随 Element 主题变量。
- GEO 与媒体发稿页面的 select 同步纳入已有 `public/shared/select.js`，不再显示系统默认菜单。
- 重新生成后台入口后执行 `php scripts/install-added-page-selects.php`、`php scripts/install-added-page-dates.php`；两者均可重复运行。新增日期解析检查：`node tests/added-page-dates.contract.cjs`。同时保留主题同步检查。

### 深色模式复核

- 实际切换经典浅色与深色，核对 GEO、门店、成品库、媒体发稿、任务列表和素材选择弹窗；面板、输入框、下拉菜单及日历随主题使用同一组颜色变量。
- 保持日历、GEO 新增证据弹窗及素材选择弹窗打开，在另一标签页往返切换主题；浮层即时同步，未提交的表单文字保留。验收后取消测试表单并恢复原来的经典浅色设置。
- 移除新增下拉按钮及顶部搜索按钮的背景颜色插值，避免主题文字已变白而旧浅色背景尚在过渡时出现短暂白闪；保留边框、阴影和交互过渡。
- 主题同步合约、日期解析合约及 PHP 语法检查通过。截图：`runtime/local/evidence/dark-geo-surface-final.png`、`dark-geo-menu-final.png`、`dark-date-picker-final.png`、`dark-material-picker-final.png`。
