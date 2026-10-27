# 素材切换、登录落点与口播顶栏修复

用户 2026-10-24 在 ai.zoco2.com 批注三项：素材页签切换卡顿；登录默认工作台；切换口播闪烁、胶囊栏位移，口播排最后。沿用本对话线上修复授权，未提交或推送 GitHub。

## 实现

- materials-v2.js 注册 inPlace 页。ui-kit.go 对同一商家、同一保留页面定义的目标使用既有 setView/history 与同步 update，不走 Nuxt 原生页面重建；其他页面与其他租户保持原路由。nav-v2 统一交给 UK.go，防止侧栏绕过此逻辑。素材元信息与列表并行请求；类型切换、卸载会取消上一轮请求，AbortError 不显示为错误，原版本序号保护保留。
- MerchantController.login 返回默认 redirect=/ai。前端既有 portal.js 继续补 tenant_id。没有修改登录来源安全检查，没有用真实客户账号重新登录来做验证。
- entries-v2.js 成为剪辑模式栏唯一所有者。clip-studio 绑定选中模式与切换动作，不再在 render 或 destroy 时直接销毁顶栏。进入 native smart_clip 仍使用相同 DOM 节点和 CSS，口播顺序为最后。保留原生口播表单、文案与分镜入口及未保存确认；过期实例卸载不能撤掉新实例的模式绑定。菜单维护改为 requestAnimationFrame 合并更新，不再被连续原生 DOM 变化反复延后。
- clip-approved-layout.css 的模式栏和顶栏规则统一使用 v2-clip-page 作用域；legacy 内容区模式栏隐藏，口播只保留文案与分镜小入口。

## 验证

通过 merchant-route-transitions.contract.cjs（保留素材外壳、history、租户隔离、其他页回退、稳定剪辑栏 DOM、口播排最后、过期清理、取消请求），clip-approved-navigation.contract.cjs 4 项，merchant-oral-entry.contract.cjs 9 项，merchant-shell-styles.contract.cjs，merchant-css-preload.contract.cjs；修改的 JS/PHP 语法通过。

线上七个静态资源 HTTP 200 且 SHA256 与已安装源文件一致。视频、旁白的 materialMeta/library 四个真实接口 code=1，服务器内 HTTPS 测得约 105–111ms；这些数字不能当作用户浏览器切换时延。没有新增生成或投稿任务，也没有替换客户当前登录会话。

浏览器此前已保存的拒绝规则未解除，未使用替代浏览器或外部无头工具绕过；本轮没有真实浏览器视觉与交互时延验收。仍需权限恢复后补做连续快速切换、前进后退和口播视觉检查。

## 部署

本机 D:/meituo-dev/project，8090。线上 /www/wwwroot/ai.zoco2.com/releases/20261024-1442，版本 u1024transition1。

九个部署文件：ui-kit.js、nav-v2.js、materials-v2.js、entries-v2.js、clip-studio.js、clip-approved-layout.css、clip-editor-v2.css、MerchantController.php、MerchantPortalMiddleware.php（仅七个引用版本更新）。

本机备份 .collab/local/ui-v2-backup/20261024-transition-fixes/；线上备份 /root/ai-zoco2-deploy/20261024-1442/merchant-transitions-20261024-185525/before/，result.json 记录部署前后 SHA256。122174 字节包分三份传输后重新组合并验总 SHA256，未触及 SSH 队列大小限制。部署先验证所有旧文件与备份，再安装并读回验证。媒体目录同步服务与每日定时器仍为 active。
