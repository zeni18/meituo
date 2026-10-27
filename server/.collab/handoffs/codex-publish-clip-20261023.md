# GEO 发布与视频剪辑 · 本机候选交接

日期：2026-10-23。用户授权继续完成之前的改版；本批为 GEO 第三批发布与视频剪辑。用户确认之前不提交、不推送 GitHub。本机项目 D:/meituo-dev/project，8090；不要切到旧 Gitee 副本，也不要采用另一台主机的 secondary-project / 3312 环境。

当前版本：geo-publish.js/css 为 u1023pub6；clip-studio.js、clip-editor-v2.css、finished-video.js、ui-kit.js 为 u1023clip9。此前 merchant-white / native mw20261023b 保持不变。仅网页、数据库运行，没有启动生成或发布 worker。

## 已交付

- GEO 发布：网站媒体、自媒体、投稿记录、收藏四页签。目录使用行业/平台导航及单行工具条，高级筛选和自定义预算放弹窗；只显示 kind 1/2，不展示接口未提供的出稿率；价格不红，包收录与一小时参考用小徽章；未选中不出现合计栏。
- 选择跨页保留、最多 20 家，服务端报价、稿件预览/新建、从内容区送入 draftId。报价确认显示预扣、可用余额、差额与充值；余额事件更新正在打开的报价，不需要重新丢弃选择。
- 报价与请求冻结品牌、稿件、媒体、类型、来源和 request_key。回执不明确时持久化原请求，刷新后仍可核对；后续授权/业务错误不抹掉旧的未知结果。不能以重新下单代替核查。
- 投稿记录分开显示发布状态和结算状态，支持时间、媒体、关键词筛选，CSV 导出及详情回链。向媒体反馈、确认发布完成均有明确确认步骤，未在真实服务执行。
- 收藏分组、重命名、移动、回收与恢复使用真实资源和 revision；收藏报价返回目录实时获取，不把历史价格当作最新报价。
- 视频剪辑：四模式留在一个编辑器，口播使用既有 script 持久化契约，不再自动跳到原生 smart_clip 页面；首次进入从一个镜头开始，切换时将已选平铺素材、字幕和旁白保留到首个镜头。旧版口播保留在工程菜单末部。
- 三栏白色编辑器增加统一材质，去掉标题副标题和重复空态入口；左素材、中编辑、右预览与全局设置。单镜头省去无效切换，镜头素材入口前移，时长等低频设置折叠；1280×720 内也能直接找到素材入口。音色、智能处理、工程/模板使用弹窗，云能力集中在效果页显示实际配置状态；未配置也可手工编辑、保存、编排。
- 生成入口显示条数和服务端 TP 费用。MerchantClipService.capabilities 新增 billing 元数据，当前商家 TP 为 0、费用由云账号承担；不把未知价格当成零。确认页提供成片组，批量提交冻结工程版本与目标，提交中锁定数量、目标和弹窗退出。
- 全局 UK 弹窗增加可访问名称与 Tab 焦点约束。工作台未改。

## 真实本机核验与边界

8090 已登录，四个发布页签与稿件选择器已检查；真实品牌没有媒体目录、投稿或发稿稿件，页面如实显示空态与待开通。剪辑已在 8090 核验口播模式留在当前页面、字幕/效果入口、配置状态与白色布局。没有新增业务记录，没有真实投稿、扣 TP、云生成或发送通知。

完整交互在 8765 隔离测试台完成：发布 24 组布局，剪辑 12 组布局，宽度 1280/1440/1920；发布主流程 8 项、发布边界 9 项、剪辑流程 8 项，另有 6 项 PHP 纯契约检查。界面检查与 PHP/JS 语法通过，日志没有本批错误。测试台模拟数据只允许 127.0.0.1:8765，不注入 8090。

重点边界：跨页最多 20 家、慢搜索响应不覆盖新结果、服务未开通不能报价、低余额不能首次提交、报价过期不创建订单、未知结果跨刷新后沿用原请求、后续授权错误保留原请求、旧自媒体地址和 draftId 转入、口播保存重开、生成确认与归组。

本机媒体服务与云合成未开通。真实供应商回执、云端效果与成片结果仍需配置并实测；测试台通过不等于供应商联调完成。若原投稿结果无法通过同一请求确定，应查看真实订单/由平台核查，不能另发新请求代替。

## 文件与备份

业务文件：public/merchant/geo-publish.js、geo-publish.css、clip-studio.js、clip-editor-v2.css、finished-video.js、ui-kit.js；app/common/service/merchant/clip/MerchantClipService.php；app/common/http/middleware/MerchantPortalMiddleware.php；docs/商家后台改版规范.md。

备份：.collab/local/ui-v2-backup/20261023-geo-publish 与 20261023-clip。新 JS/CSS 无旧文件；既有脚本、样式和中间件已在修改前保留。测试台新增 mock-publish.js / mock-clip.js 并调整 index.html，没有改变生产服务路由。

本机工作文件与可复现测试：D:/AI营销中台/_sync/geo-publish-20261023 和 D:/AI营销中台/_sync/clip-editor-20261023。当前仓库仍包含此前白色主题、导航、品牌/GEO 内容等未提交改动。不要强制还原、整体覆盖或直接拉取压掉这些文件；不盲目执行上一批部署脚本。

## 审阅材料

- 发布改前：[截图](assets/codex-publish-clip-20261023/before-publish-1280.png)
- 发布本机候选：[截图](assets/codex-publish-clip-20261023/after-publish-1280.png)
- 剪辑改前：[截图](assets/codex-publish-clip-20261023/before-clip-1280.png)
- 剪辑本机候选：[截图](assets/codex-publish-clip-20261023/after-clip-1280.png)
- 口播本机候选：[截图](assets/codex-publish-clip-20261023/after-oral-1280.png)
- 1440 有数据发布示例来自隔离测试台，不能作为真实媒体报价或业绩：[截图](assets/codex-publish-clip-20261023/publish-fixture-1440.png)
- 报价确认同样来自隔离测试台：[截图](assets/codex-publish-clip-20261023/quote-fixture-1440.png)
- 布局与流程报告见同目录 publish-report.json、publish-edge-report.json、clip-report.json。

仍待后续页面：AI 工具、图像/视频创作、数字人、门店营销、自动化、头像菜单其余改版；视频 J3 真实云实测与 AI 视频自动归组仍有后续工作。没有宣称整站全部完成。规范和交接只更新本机，未改外部云端文档。
