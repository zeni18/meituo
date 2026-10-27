# 美拓AI营销中台系统名称

用户明确将系统名称更正为“美拓AI营销中台”，并要求各端登录完成。已更新当前本地平台配置及租户1的OEM/商家站点名称、PC标题和登录标题，源码默认值及当前平台/PC登录默认页脚同步更名；独立商家名称、客户品牌知识、账号、角色、计费与授权策略没有修改。历史迁移SQL、旧发布备份和第三方许可证不作系统名称替换。

本地配置更新脚本：scripts/set-local-system-brand.php，仅允许 aigc_local:3307，幂等更新当前系统名称。配置默认值位于 config/project.php，默认页脚位于 ConfigService。商家登录静态文案与脚本版本同步更新。没有重置密码或延长会话时限。

浏览器实际登录并核对：商家 localhost:8090/ai?tenant_id=1，OEM localhost:8090/admin/workbench?tenant_id=1，平台127.0.0.1:8090/platform/workbench，代理agent.localhost:8090/admin/agent-workbench?tenant_id=1。代理使用独立本地域名隔离OEM会话。当前现有可用代理为一级代理。四个原标签已保留，临时商家标签关闭。

验证：PHP语法检查通过；浏览器核对商家登录页、四端后台名称及实际工作台内容，OEM在商家登录后刷新仍保持原角色。未改动认证模块，未发起供应商调用。PHPUnit入口在当前工作目录不可用，未报告自动测试通过。截图位于 runtime/local/evidence/meituo-merchant-home.png、meituo-platform-home.png、meituo-oem-home.png、meituo-agent-home.png、meituo-login.png。
