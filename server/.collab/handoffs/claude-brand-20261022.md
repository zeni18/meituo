# 副机 Claude 交接：品牌与门店改版

工位：副机 Claude（云端克隆，推送 GitHub）
分支：10-23 起直接在 **main** 上（原 `dev/secondary/claude-brand-ui` 的两个提交已摘到 main，依赖的作品库原稿修正 main 已包含）
任务目标：品牌与门店页按《商家后台改版规范》B1–B5 重做，K5 企业知识库抽屉

## 改动

| 文件 | 内容 |
|---|---|
| `public/merchant/brand-v2.js` / `.css`（新） | 品牌与门店整页（ui-kit 页面，key `brands`，路由 `/ai/stores`） |
| `app/common/http/middleware/MerchantPortalMiddleware.php` | 注入 `brand-v2.js`（在 assets-v2.js 之后、workspace.js 之前）和 `brand-v2.css`，版本 `u10221620`；原文件已备份到电脑 `output\ui-v2-backup\20261022-1620-brand\` |
| `docs/商家后台改版规范.md` | 第 2 节（协议作废、优先级）、第 11 节 K5、第 14 节进度、第 16 节文件清单、更新记录 |

没有改后端接口，全部用现有接口：`merchantWorkspace` 的 brandLists / brandChoices / brandDetail / brandSave / brandKnowledgeSave / brandRecycle / storeLists / storeSave / storeBatch / storeImport / storeLogo / recycle(store) / storeStaff / storeStaffSave / storeStaffBatch / storeStaffRecycle / storeRequest / storeRequests / storeRequestCancel / storeDesign；`merchantGeo` 的 options / generate / jobs / workspaceRecords / contentSave；`merchantPublishing/staff`（公众号绑定状态）。

## 页面结构

- 列表：页签「品牌 / 门店」。品牌卡（封面题注、门店/员工/关键词/文章、知识环、门店状态点、收不到通知人数）；门店页签跨品牌（左侧按品牌，状态下拉）。回收站抽屉（品牌 + 门店）。
- 品牌详情 `?brand_id=&tab=`：资料（分区阅读、单区编辑、AI 强化）/ 知识库（分类、文档卡、新增、导入 TXT·MD）/ 门店（状态导航、到期天数、窗口内门店详情、续期与码牌激活申请、申请记录、门店回收站）/ 员工（按门店、绑定状态、批量导入、导出、员工回收站）/ 装修（每店装修状态 + 进入原编辑器）。
- 旧地址：`#knowledge` `#stores` `#overview` 映射到新页签；`#content` → `/ai/geo#keywords`，`#statistics` → `/ai/geo#dashboard`；`?store_id=&store_editor=1` 直接打开装修编辑器。
- 旧 `brand-directory.js` / `store-directory.js` 仍然加载，由 UK_OWNS 让位；装修编辑器沿用 `storefront-designer.js`（`window.MerchantStoreDesigner`）。

## 验证

- `node --check`、`php -l` 通过。
- 用无头浏览器在模拟数据上走完：品牌列表（3 个品牌、空列表）、资料编辑保存、K5 抽屉、AI 强化（开通 / 待开通两种）、知识库新增与查看、门店新增、批量创建（预览）、门店详情菜单、续期申请（重复申请报错）、员工新增、CSV 导入预览、员工菜单、员工回收站、装修列表；1280 / 1440 无横向滚动，控制台无报错。模拟数据的字段和真实接口一致（在 8090 上逐个 GET 核对过）。
- 在 8090 真实后端上用 GET 核对了本页用到的所有读取接口及参数（brandLists page_size 48、storeLists page_size 50、trash、brand_id、merchantPublishing/staff、storeDesign、workspaceRecords 带 brand_id/category/keyword），全部返回成功、字段齐全。没有在真实数据上做任何写操作。
- 还没在 8093 上整页跑过。部署后请在真实数据上看一遍列表、品牌详情五个页签、门店详情；写操作请用测试品牌，测完在回收站清掉。

## 对照图

`claude-brand-20261022/` 目录：品牌列表、品牌详情、门店的前后对照，及改后的知识库 / 员工 / 门店详情。

## 待办及风险

- 知识文档目前没有删除接口（GEO 那边也没有），本页只能新增和编辑。
- 员工公众号绑定功能还没接入：表格显示绑定状态，提示条不放「去处理」按钮，悬停说明“接入后可以发绑定邀请”。
- K5 抽屉现在在 `brand-v2.js` 里，GEO 改版时提升到 ui-kit 供 GEO 选用。
