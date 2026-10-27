# 品牌与门店联系电话校验

用户报告创建品牌时可以输入很长的电话号码。根因：brand-v2 的联系电话只设置 maxlength=32，MerchantBrandService 和 MerchantWorkspaceService 保存时也只验证字符长度。修复前真实开发库回归复现「Brand create accepted an invalid contact number」，事务已回滚。

## 实现与范围

新增 MerchantContactPhone 统一服务：电话号码选填；支持11位手机号、国内座机/本地座机、400/800客服电话、95服务号码、以 + 开头且不超过15位数字的国际号码、最多6位分机。统一全角数字/标点；不把不合法的长号码截短后保存。分机格式规范为「主号 转 分机」，保持结果不超过原数据库32字符容量。

品牌与门店表单使用电话键盘提示和自动填充，输入按号码类型限制数字位数，超长粘贴整段阻止，保留原值并在字段下方提示。失焦/保存检查格式；无效输入带 aria-invalid、关联错误描述，提交定位到字段。输入过程中只校验，不重写值或移动光标。兼容历史格式的展示，已有无效号码需要用户修正后保存，不批量修改客户记录。

MerchantBrandService、MerchantWorkspaceService 的门店保存分支、MerchantStoreService 导入预览均使用统一规则；createMany 经原事务保存逐行校验，失败不会留下前半批记录。未改员工/登录手机号规则。

## 验证

- tests/merchant-contact-phone.contract.php/cjs 读取同一份17个合法与17个无效格式样例；PHP另拒绝数组/数值/布尔参数。
- 前端验证输入第12个手机号数字阻止、超长粘贴整段拒绝、选区替换、全角数字、自动填充/程序赋值不绕过保存校验、空号选填和光标保留。
- 真实表单测试验证品牌和门店电话号码不合法时不发起保存请求；旧网址规范化、重名恢复、图片上传预览等契约仍通过。
- tests/merchant-contact-phone.integration.php 在 aigc_dev_ 开发库验证品牌/门店新建编辑、旧门店API、批量原子性和CSV导入预览，共11项，所有临时行事务回滚。既有品牌保存24项回归也通过。
- 线上实际部署类同样通过17合法/17无效样例；七个源文件和两个公网静态资源的SHA256全部匹配。没有用客户真实资料做写入验证。
- 浏览器已保存的权限规则仍拒绝访问生产域名，未绕过该限制；实际浏览器视觉/输入手感验收待补。

## 部署与回滚

本机备份：.collab/local/ui-v2-backup/20261026-contact-phone/。线上备份：/root/ai-zoco2-deploy/20261024-1442/merchant-contact-phone-20261026-131030/，包含 before/、result.json、verification.json；新增 MerchantContactPhone 在旧版本不存在，回滚需按 manifest 区分。

部署文件：MerchantContactPhone.php、MerchantBrandService.php、MerchantWorkspaceService.php、MerchantStoreService.php、brand-v2.js、brand-v2.css、MerchantPortalMiddleware.php（仅品牌JS/CSS版本 u1026phone1）。包SHA256：7f9824c03c071880f62746b652341c2aa63bb68fec811bd92a16844f5afe44d1。保留其他既有修复，未提交推送 GitHub。

## 同轮待处理：服务商后台404

服务器密码窗口已重新连接，取消了此前人为两小时期限，传输每30秒保活；进程/窗口或网络断开仍会结束连接，不保存服务器密码。网页入口/admin/、/admin/login 均200；入口/登录/工作台依赖47个JS资源200且与本机一致。线上 owner id=1、root=1、disable=0；256个有效菜单，工作台 workbench/index 为首个可见菜单，无孤儿菜单和异常前缀。访问日志显示10月26日11:22工作台与多个业务接口均有成功HTTP访问。

使用已有会话作业务API状态检查时返回「ip地址发生变化，请重新登录」。没有伪造来源IP、关闭IP检查或创建新会话。纯内存测试使用正式编译入口的路由守卫与注册函数，确认根地址/工作台在有会话时指向 /workbench，无会话时指向 /login。尚未复现用户看到的具体404，不应盲改路由或宣称已修复；已询问用户是打开入口立即出现，还是输入账号后出现，等待回复。受浏览器权限限制，未在侧边栏代登录。
