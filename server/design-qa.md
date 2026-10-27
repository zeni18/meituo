# 商家素材库视觉验收

参考：用户四张素材库截图。目标结构为左分组栏、顶部分类、素材网格、底部选择分页；用户指定视觉沿用现有系统，因此白底紫色改为原深色绿色，保留原主导航与字号。参考中的业务素材不复制到真实商家库；空态采用现有风格与 Feather 标准图标。

## 首轮（修复中）

- [P1] 上传主按钮受原前端按钮规则覆盖，绿色背景丢失，深色文字难以辨认。证据：`runtime/local/evidence/material-library-initial.jpg` 与浏览器 computed background=transparent。修复：提高素材库范围内主按钮选择器优先级，保留绿色底。
- 文件夹、分类、搜索、标签入口、网格空态、底部分页与多选已出现；需继续验收真实操作、窄屏和媒体内容态。
- [P2] 首次并排比对发现大屏空态仍按固定最小高度排在上方，参考空态位于剩余内容区中央。修复：内容区与空态网格采用弹性填充，空态占满剩余高度并居中。原参考为高分辨率截图，比对时按约2倍像素密度转换到1731px逻辑内容宽度，保留原应用额外外侧导航。

## 必检表面

- 字体：沿用原系统字体，导航和操作12–14px，统一线性18px图标。
- 布局：参考内侧分组栏与密集素材区，不增加内容标题横幅。
- 颜色：按用户要求使用现有深绿背景、浅绿选中和按钮。
- 图像：使用真实上传素材；无虚构素材计数、分析结果或人物；图标来自 Feather 4.29.2，保留 MIT 许可。
- 文案：六个真实分类，保留原图文和话题；未实施AI分析不提供假按钮。

## 修复后的比对与操作验收

- 并排对照：`runtime/local/evidence/material-library-design-comparison-final.jpg`。参考图以约2倍截图像素密度转换，最终素材内容宽1731px，与参考的逻辑内容宽相同；渲染内容高874px，外层原系统导航保留。
- P1主按钮修复：绿色底与深色文字已恢复，computed background=`rgb(171,229,196)`。P2空态修复：占满剩余内容区并居中，最终截图中空态位置、分组栏/分类/工具栏关系与目标结构一致。
- 字体与排版：保留原系统字体；类型/文件夹/操作文本12–14px，图标16–18px，标签与文件名截断正确。没有新增英文标题、营销横幅或异体字体。
- 间距与布局：225px大屏分组栏（普通桌面208px），文件夹内缩表示层级；顶部类型居中、操作居右；卡片密集网格，底部分页与批量条固定。380px窄屏无文档横溢，文件夹可展开，分类可横滚，表单和按钮换行，核心触控区域44px。
- 色彩：白紫参考转换为本系统深色绿色是用户明确要求；选中、上传与焦点使用同一浅绿色。已修复原样式覆盖，禁用态与错误态可区分。
- 图像/音频：原参考业务素材不导入商家库。真实上传图片 naturalWidth=1040、complete=true；真实1秒WAV readyState=4、duration=1、无媒体错误；已修复工作目录错误造成的资源无法访问。空态采用Feather标准图标，未仿造其他产品紫色吉祥物。
- 文案与状态：新增四类与原图文/话题均可切换；文件夹、标签、上传、预览、移动、回收、恢复、分页和选择是实际操作。使用状态来自实际种草卡引用，不显示假分析、合成或裁剪计数。保留原门店关联与图文附件。
- 权限和回归：素材库83项HTTP检查＋原工作区128项回归通过；混入其他商家记录会整体拒绝。测试数据已清理，无AI生成调用。
- 控制台：浏览器未发现JavaScript错误。临时视口设置已恢复。

可接受差异：沿用本系统主题与主导航；保留图文、话题两个已有分类；现有商家无素材和文件夹，使用真实空态；未实现的分析/拼图功能不做空按钮。

无未解决的P0/P1/P2。后续可根据真实素材数量继续微调默认网格密度。

final result: passed

## 2026-10-20 — UI v2 工作台接续收尾

本节采用当天定版的 `docs/merchant-ui-v2.md`。旧章节中的深色主题和早期参考图要求属于历史验收，不作为本轮风格依据。

- 复现：1280px 视口、984px 内容区中，四张统计卡按自动最小列宽排成三列，素材卡单独换行。改为内容区驱动的四／二／一列：900px 以上四列，520～900px 两列，520px 及以下一列。
- 复现：充值按钮计算背景为透明，原生前端较晚加载的 `[type="button"]` 重置覆盖了 `.wb-chip-solid`。增加工作台内选择器优先级并使用既有 UI Token，修复后背景为白色、文字为深色。
- 补充工作台操作按钮的可见键盘焦点；窄屏主要按钮、余额按钮及区块链接至少 44px 高。
- 实际浏览器验收：1280px 四列、1024px 两列、390px 单列；三个尺寸文档宽度均未超过视口。390px 四个操作按钮均为44px高。桌面和手机截图已实际查看，无控制台错误。
- PHP 中间件语法通过；入口样式版本已更新。没有变更数据接口、余额、生成任务或提交业务操作。
- 原文件备份：工作区 `output/ui-v2-backup/20261020-workbench-polish/`。

本轮只完成工作台上述视觉缺口；不代表素材库、作品库、视频剪辑和阶段 3 共用组件已完成全站 UI v2 验收。


## 2026-10-18 — Asset hub and material navigation
- Asset categories now live in a persistent page tab bar: All / Films / Graphics / Topics. The three duplicate sidebar entries and right-hand Films entry were removed. Existing catalog operations and deep links remain.
- Native All now includes uploads. Owned graphic/topic/copy/image-library/audio and completed clip content is also read through existing owner-scoped APIs, all pages with bounded concurrency; it has independent content filtering and preview. Physical image/video uploads remain in the native area to avoid duplicate material cards.
- Material type links switch the existing library in place. Shell, controls and focus survive; only type-specific data resets. Request epochs reject late results. Desktop result scrolling, loading and empty state heights are stable. Browser Back / Forward checked.
- Validation: all-asset filter contract; finished-library contract; picker selection contract; folder ordering contract; finished-video destination contract; 32 transactional finished-catalog integration checks (rolled back).


## 2026-10-18 — GEO Article Library
- Added a fifth asset tab, Article Library, using a real paginated article table. Title, brand, category, word count and update time lead into preview/edit actions.
- Uses existing GEO article storage and optimistic save hashes; All Assets and GEO Content Center show the same record.
- Table capacity follows the selected 10/20/50 rows; column widths stay stable through loading and empty states.
- Checked actual create, preview, edit, All Assets update and GEO Content Center update using one temporary clearly labeled article, then cleaned it. No AI or publishing request executed.
- Backend: 16 transactional isolation/pagination/hash/soft-delete checks passed; no schema changes.


## 2026-10-18 — Four nested GEO destinations
- Replaced six flat GEO sidebar links with an expandable parent and exactly four child links: Diagnosis / Automation / Media / AI Creation.
- Retained all old hash routes, contextual tools and brand/tenant links. Overview and reports now belong to Diagnosis; AI tasks belong to Creation.
- Checked expand/collapse without navigation, all four destinations, active links and AI writing dialog return; production build, TypeScript and navigation/diagnosis contracts passed.
- No diagnostic submission, generation or publishing action was executed.

## 2026-10-19 接入能力配置合并 GEO

平台及 OEM 的接入能力配置列表加入 GEO 五项能力，保留原剪辑八项。GEO表单以可销毁的嵌入组件复用原 geo.config API，配置/授权权限和凭证来源不变。两组列表独立读取，未授权或加载失败分开提示。保留旧 geo/config 与 geo/jobs，兼容原链接和仅有 GEO 权限的员工。

验证：两端菜单进入、URL直达指定能力、剪辑/GEO来回切换、键盘选择、未保存取消保留输入、确认丢弃后恢复服务端原值、未适配配置禁用、原GEO配置及任务页；两端控制台无错误。Node语法检查、两安装脚本PHP语法检查通过。未保存真实配置、未授予使用权限、未调用任何收费服务。截图：runtime/local/evidence/unified-capabilities-oem.png。


## 2026-10-19 统一入口、海讯社配置与实际连通检查

- 平台/OEM/代理导航仅保留接入能力配置，旧 GEO 和平台海讯社地址跳转同一页面。菜单合并在角色过滤后执行，原接口权限保留；代理统一路由兼容已验收。
- 海讯社嵌入表单包含凭证、加价、本站域名、资源同步；按用户要求，有配置编辑权限的总后台回显凭证，保存按当前值更新。只读账号不接收明文，操作日志对响应脱敏，数据库保留加密。
- 启用接口与资源同步不再强制公网域名，发稿费用核对和下单前验证域名，缺失时不预扣。检查功能无需启用发稿，按保存版本调用认证和15类资源只读接口。
- 14项菜单权限保持检查、19项凭证/日志/域名检查、51项离线资源检查通过；相关 PHP/JS 语法通过。
- 实际浏览器验收：旧地址跳转、平台/OEM侧栏、代理仅GEO权限、取消/确认丢弃未保存内容、凭证文本回显布尔检查、浏览器错误日志为空。最终报告和交付截图不包含凭证。
- 用户授权实测海讯社：15/15类资源接口成功，样本与数量见 docs/research/2026-10-19-haipress-live-capabilities.md。没有保存/更改用户服务配置、没有发稿或充值。统一接入入口截图 runtime/local/evidence/haipress-live-inspection.png。

## 2026-10-19 海讯社一键全量资源同步

- 逐页操作替换为“一键同步全部”，15类资源分组显示进度、计数、失败原因及续传按钮。页面刷新后读取同一持久化任务，关闭页面不影响服务器执行。常驻资源服务与每日定时命令共用任务租约。
- 每页500条，保留媒体ID、历史订单引用和分类特有字段；只在完整类别成功后停用未返回旧资源，失败类别不执行缺失资源下架。商家资源选择与报价仍限制已接入的1/2类。
- 35项事务集成检查通过（无供方HTTP，测试数据回滚），另51项接口检查与19项凭证/域名检查通过。PHP、JavaScript与PowerShell语法通过；实际浏览器无控制台错误，无横向溢出。
- 已从实际后台按钮启动首轮全量任务，截图时已同步73,809条、13/15类完成；国内软文和自媒体仍在运行，尚未宣称首轮全部完成。重复触发按钮禁用，刷新后进度恢复。当前本地资源worker保持运行，无发稿订单或充值操作。
- 部署和宝塔定时说明：docs/haipress-resource-sync.md；生产服务器计划尚未创建。最终截图runtime/local/evidence/haipress-all-resource-sync.png只包含资源同步与定时说明区域，不包含凭证。

## 2026-10-19 接入能力配置滚动修复

- 复现：原后台 body 禁止滚动，嵌入配置页隐藏了原路由滚动区，而 main 仍为 overflow:visible。滚轮下滑时 main.scrollTop 一直为0；此前按钮自动聚焦触发的文档偏移不能代表滚轮可用。
- 修复：仅对配置页激活的 main/.el-main 设置高度约束、纵向自动滚动、稳定滚动条及边界限制。离开配置页移除激活类后恢复原布局。平台、OEM页面和安装脚本同步更新资源版本。
- 验证：实际滚轮向下 main.scrollTop 从0变为631，向上回到0，再次向下可到页面末尾；文档滚动始终为0，后台顶部与侧栏保持固定。下方接口检查区域完整位于视口内，控制台无错误。JS/PHP语法通过。
- 交付截图：runtime/local/evidence/haipress-scroll-fixed.png。截图位于页面下方，不包含凭证输入框。
- 本次滚动验收结束时，首轮真实同步已在后台全部完成：15/15类，198,908条；最终滚动截图同时记录了完成状态。


## 2026-10-19 — 媒体发布重构

- 按用户参考图改为四页签、行业／地区／价格筛选、比较表格与底部已选费用条，保留现有商家主导航与真实资源数据。
- 按后续指示将行业和地区全部平铺；PC／移动权重 0 显示“—”；新增自定义价格边界，支持单边范围和小数。
- 修复 Select 出屏、长页面弹窗裁切及旧发布样式名称冲突。已验证真实筛选、排序、收藏、跨页签选择、金额汇总和选稿入口。
- 验收截图：`runtime/local/evidence/media-publishing-redesign.png`。34 项服务端集成检查、TypeScript 与生产构建通过。浏览器未见控制台错误，桌面和窄屏无文档横向溢出。
- 正式发稿仍要求配置本站公网访问域名；验收未创建付费订单。


### 媒体筛选展开／收起补充

- 行业／地区默认显示常用选项，各自提供展开和收起按钮。展开继续采用平铺按钮，收起保留当前选中的非常用选项。
- 浏览器验证：行业展开显示 47 个选项、地区保持收起；选中“文化艺术”后收起保留高亮及筛选结果；地区选中“山东”后收起保留。Enter 键可操作展开／收起。
- TypeScript 与生产构建通过。截图：`runtime/local/evidence/media-filters-collapsed.png`。


### 媒体筛选入口位置及分页留白

- 展开／收起移入选项流，紧跟最后一个可见选项，浏览器实测相邻间距 8px，不再固定在最右侧。
- 根因：全局留白脚本没有读到新分页器的每页条数，默认按 20 条撑高。共享分页器现已显式提供容量；媒体双行记录由组件按缺少的记录数补位，避免重复设置最小高度。
- 自媒体第一页 10 条：表格与背景容器均高 1034.28px，分页容器紧接表格，额外留白为 0。最后一页 7 条：仅预留 3 条的空间（276px），验证后返回第一页。
- 构建、PHP 语法与脚本语法检查通过。截图：`runtime/local/evidence/media-inline-expand.png`、`runtime/local/evidence/media-list-spacing-fixed.png`。

### 媒体案例直达网址

- 案例入口使用原生新标签页链接，后台按需解析供方案例预览中的实际网址并跳转，保留列表状态；无效案例提供明确提示。
- 实测艾肯家电网的入口直接到达对应文章，未显示海讯社预览中间页。网站及自媒体样本解析通过，嵌套 HTML 转义查询参数正确解码。
- 20 项 URL 解析检查、38 项目录集成检查、TypeScript 与生产构建通过。截图：`runtime/local/evidence/media-case-direct.png`。

### 包收录筛选

- 常用筛选增加“收录要求：不限／包收录／不包收录”，按国内软文 `searchcollint=1/0` 筛选，缺失或未知编码不归类；支持条件标签、重置和组合查询。自媒体不展示不适用的条件。
- 浏览器验证：包收录 4,596 家、不包收录 54,577 家、重置后 59,192 家；其余 19 家为供方未在国内软文文档定义的编码 2，未推断其含义。控制台无错误。
- 45 项目录集成检查、TypeScript 与生产构建通过。未发起监测采样或付费发稿。截图：`runtime/local/evidence/media-indexing-filter.png`。


## 2026-10-20 — 视频剪辑页参考图优化

参考：用户上传的 `codex-clipboard-88b89730-83cf-438e-b134-4d6ded23b716.png`。目标为商家现有 `/ai/video-editor?tenant_id=1` 的空态。

### 捕获与对照

- 源图1555×1011，最终页面CSS视口1555×1011、截图1555×1011，无密度缩放；同一浅色主题、一键成片空态、9:16画幅、25FPS、默认字幕和声音参数。保留原生248px侧栏，参考侧栏222px，内容区域因此缩窄26px；没有为本页改变其他页面的导航尺寸。
- 同图并排证据：`runtime/local/clip-reference-comparison-final-20261020.png`；配置区及补充素材的清晰对照：`runtime/local/clip-reference-detail-20261020.png`。已打开两份组合输入评估，未以单独截图或构建通过代替视觉验收。
- 最终实现：`runtime/local/clip-reference-final-20261020.png`；手机390×844：`runtime/local/clip-mobile-final-20261020.png`；手机预览滚动状态：`runtime/local/clip-mobile-preview-20261020.png`。

### 首轮发现与修复

- [P1，已修复] 首轮素材区和配置卡片过高，三项补充素材的添加按钮被挤出首屏。调整插画透明留白的显示窗口、配置行内边距和嵌套素材池的默认margin；第二轮及最终截图三个卡片完整可用。
- [P2，已修复] 原全局主按钮规则覆盖预览操作的淡紫样式。限定预览操作选择器优先级，最终为淡紫底、紫色文字，真实禁用状态保留。
- [P2，已修复] 标准图标容器最初与按钮标题都使用span，使旧代码查询标题时命中图标。图标改为独立aria-hidden的i元素，添加素材、播放/暂停和工程保存标题恢复原行为；真实素材播放0.2/5.0秒以及恢复“播放排版”状态通过。

### 必检表面

- 字体：沿用原系统中文字体；页面标题24px、卡片标题18px、主体13–14px、说明11.5–12px；参考的大小/粗细层级已对齐，未替换整站字体。手机标题和操作换行不重叠。
- 间距与布局：顶部四模式与五操作集中，素材/配置/三个补充卡片在左，白色预览面板在右；20px主卡内边距、14px间隔、18px圆角。时长预计值同排，帧率与展开设置同排；较窄桌面允许自然换行。
- 色彩：白色内容卡、浅灰紫画布、紫色动作、深灰模式选中、金色模板入口；仅播放画面使用深色。原全应用主题变量与深色模式入口保留；未更改用户的主题偏好。
- 图像：空态单独生成透明PNG，非CSS绘制或截图背景；显示时只裁透明边距，无文字重绘、变形或占位图。新增图标来自原已用的Feather 4.29.2，复用MIT许可。真实图片加入后使用其原文件预览。
- 文案：参考中的素材/配置/预览命名及操作文案落地。原云合成配置状态继续显示真实值，排版预览提示保持事实准确，没有虚构合成结果。
- 响应式：375、390、414、768、1024、1440、1555宽度已检查；文档无横向溢出。390下文档宽380（预留滚动条），上下顺序及预览展开/收起正常。手机主要操作按钮和切换控件至少44px高。
- 交互：四种模式及未保存确认、16:9和30FPS选中、高级设置展开/收起、全局字幕内容、音量弹窗更改0.5→0.3的摘要同步、真实图片勾选/加入/播放、预览收起/展开、工程列表入口均通过。未保存测试内容随临时页面刷新清除，未新建工程或调用付费服务。
- 页面生命周期：离开到素材管理后剪辑页标题计数0，返回后计数1；原搜索、通知、账户与导航未替换。
- 回归：JS语法、CSS解析、PHP中间件语法通过；素材选择、镜头排序及动画契约检查通过。最终浏览器控制台无错误。本轮未提交云合成、配音或AI调用。
- 素材库首次读取元信息曾出现一次网络失败，切换类型后计数及文件夹恢复；后续真实选择和图片播放通过。未修改素材库接口、用户素材或服务器配置。

可接受差异：保留原站侧栏宽度、原搜索入口/用户账户；保留真实云合成状态的简短底栏；模板与主按钮复用现有品牌色。空态插画是按源图独立重建的图像，并非整图裁切；不影响布局和交互。

无未解决P0/P1/P2。完成清单：同尺寸桌面组合对照、关键细节对照、响应式、核心流程、控制台、原回归、临时视口恢复均完成。

final result: passed
