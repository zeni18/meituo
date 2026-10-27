# 商家系统名称接入后台配置

用户 2026-10-24 批注左上角「美拓AI营销中台」应能后台自定义。沿用本对话 ai.zoco2.com 线上修复授权；已写入本机 8090 并部署线上，未提交或推送 GitHub。

## 设置入口及行为

服务商后台：系统设置 → 网站设置 → 网站信息。前台设置中的「前台名称」（website.shop_name）控制商家侧栏和登录页名称；PC端设置中的「网站标题」（website.pc_title）独立控制商家浏览器标题。后台设置中的「网站名称」（tenant.name）仍控制服务商后台。保存后刷新商家页生效。

原生商家侧栏此前优先使用 pc_title，而登录页使用 shop_name，两个字段含义混用。MerchantBrandingService 通过既有 ConfigService 读取当前租户，API、登录模板和页面启动配置共用同一来源。登录首屏服务器替换名称，不先显示写死品牌。侧栏保留既定黑色标识；长名称省略、悬停和 aria-label 保留完整内容。Vue 重绘时观察器在延迟布局处理之前恢复正确名称，无额外轮询或切页配置请求。启动配置 JSON 使用 HEX 转义，HTML 字段转义；不把跨租户启动名称应用到当前租户。

## 验证

- merchant-branding.contract.php：名称/SEO 标题独立、租户隔离、空配置回退、登录首屏与 HTML/脚本转义。
- merchant-branding.contract.cjs：配置文本、无障碍名称、长名称、重绘不循环、原生重绘后立即恢复、租户不混用。
- merchant-branding-save.integration.php：仅允许 aigc_dev_ 开发库，调用真实 WebSettingLogic 网站设置保存逻辑，三个不同名称分别保存并读取，商家配置及登录模板跟随前台名称。事务回滚后所有租户配置行哈希与执行前一致。
- 原素材保留外壳切换、剪辑导航、口播入口、样式预加载契约测试全部通过。修改 JS/PHP 语法通过。
- 线上 merchant/config 返回 code=1，name/title/logo/favicon 均正确；六个部署文件落盘 SHA256 校验通过，静态资源额外校验。媒体目录服务和每日同步定时器均 active。

浏览器对生产及本机测试站点的已保存拒绝规则仍未解除，未使用其他浏览器或无头工具绕过；本次未完成浏览器视觉验收。

## 文件与回滚

六个部署文件：新增 app/common/service/merchant/MerchantBrandingService.php；修改 MerchantController.php、MerchantPortalMiddleware.php、app/view/merchant/login.html、public/merchant/ui-kit.js、public/merchant/ui-kit.css。没有改客户品牌/门店数据、账号或生成发布任务。

本机备份：.collab/local/ui-v2-backup/20261024-branding-settings/。

线上第一次备份：/root/ai-zoco2-deploy/20261024-1442/merchant-branding-settings-20261024-190502/（恢复到本次改动前；新增 service 当时不存在，回滚需按 manifest 区分）。后续绘制时机修正备份：merchant-branding-settings-20261024-190717/。两个目录均有 before/ 和 result.json，包含前后哈希。

最终 ui-kit.js 引用 u1024brandname2；ui-kit.css 和登录 portal.js 引用 u1024brandname1。此前 u1024transition1 其他资源、u1024brand4 品牌表单、u1024geo1 发布模块引用保留。最终部署包 SHA256：2ab452db7f6341f3a9501bef9892808091fb3106b2854d499578f45a619380ba。
