# 多设备同时登录

用户反馈登录新设备会使另一台掉线。本机与 ai.zoco2.com 已修复；没有提交或推送 GitHub。

## 原因与行为

- 商家 UserTokenService 按 tenant_id/user_id/terminal 找同一行，替换 token 并删除旧缓存。现在每次成功登录生成独立的32字符随机 token 和会话行，其他设备的 token 保留。
- 服务商、平台后台原来的 multipoint_login=1 会复用 token，登录缓存却写入最新设备的 login_ip，导致另一台触发原有 IP 检查。现在每次登录独立 token/缓存；IP 权限中间件不变。账号的 multipoint_login=0 仍按原意只保留同类终端的一处登录；在账号行上加锁，避免并发登录绕过该设置。
- 原后台多处登录模式下退出根本不撤销服务端 token。现在退出只撤销当前 token，其他独立会话保留。续期不复活已退出或自然过期的会话。
- 平台进入服务商后台的 SSO 入口也取消共享 token；仍锁定并单次消费票据、检查租户有效期和账号状态，并锁定管理员行以遵守同一并发登录策略。
- 新会话继承 OEM 物理分表后缀；本次生产租户使用共享表。没有修改登录密码、Origin 检查、权限路由、商家身份检查、云配置或计费。

## 数据库与安装

原三张会话表都有 (account_id,terminal) 唯一索引，必须改成普通查询索引才能保存多台设备。scripts/migrate-multi-device-sessions.php 先检查全部目标表、保留 token 唯一索引，--apply 才调整索引，重复执行无改动；支持租户分表并要求生产显式指定 --expected-db。商家普通索引包含 tenant_id/user_id/terminal。public/install/db/like.sql 同步新安装结构。没有删改生产会话行，原有三个会话的 id/token 在迁移前后均保留。

本机开发库 aigc_dev_primary_3311 已迁移；生产库只操作 ai_zoco2_prod。没有操作 master.siroc.cn。

## 验证

- tests/multi-device-sessions.integration.php：41项真实开发库事务检查通过，包括商家三设备、跨租户拒绝、缓存重建、独立续期/退出、失效 token 不复活、商家停用、后台不同模拟请求地址各自通过原 IP 检查、错误地址仍拒绝、管理员停用、显式单处登录、SSO多设备/单次票据/退出。全部临时账号、会话和票据回滚，仅删除本次测试 token 的缓存。
- tests/multi-device-concurrency.integration.php：25次真实并行子进程登录，36项检查通过。覆盖商家、服务商和平台多处登录各5次、服务商和平台单处登录各5次，测试账号及其会话均清理。
- 线上以 www 身份执行41项同等事务检查通过，生产临时账号、票据和会话均回滚，现有三张会话表各一行记录保留。五个生产源文件分两批做部署前摘要/备份/PHP语法检查与部署后摘要核验；三张表 token 唯一索引保留，账号终端索引均非唯一。
- 剪辑 worker、媒体目录 service 均仍 active。未重启共享 PHP/Nginx 服务，未创建付费业务任务。
- 浏览器保存的访问权限限制仍在，未使用其他浏览器、CDP或无头方式绕过；尚未做两台真实设备联测。验证结论是服务端会话、权限及并发行为通过。

## 文件与回滚

本机备份：.collab/local/ui-v2-backup/20261026-multi-device/，包括原三个 token 服务、TenantSsoService、新安装 SQL、开发库原会话表结构和记录。此目录忽略 Git，记录中的 token 不对外输出。

生产备份（root私有）：

- /root/ai-zoco2-deploy/20261024-1442/multi-device-20261026-205605/：四个应用文件候选/原文件、三张表结构和原记录（600权限）、迁移结果及35项初始验证。
- /root/ai-zoco2-deploy/20261024-1442/multi-device-sso-20261026-205831/：SSO原文件、结构/会话快照、41项最终验证与部署结果。

验证脚本在 shared/runtime/multi-device-check-20261026/，www可读、目录750/文件640，必须CLI显式 --production-rollback-check 才运行。不要放入 public 或输出其中会话信息。

应用文件：app/api/service/UserTokenService.php、app/tenantapi/service/TenantTokenService.php、app/platformapi/service/AdminTokenService.php、app/common/service/auth/LoginSessionService.php、app/common/service/tenant/TenantSsoService.php。

如需回滚，先核对当前摘要和后续修改。代码可按对应备份恢复；不要直接恢复生产会话表快照或重建账号终端唯一索引，因为上线后的新设备会话可能已经存在，盲目恢复会注销新设备。旧代码配普通索引仍可运行，其旧登录行为也会恢复。

已掉线的设备重新登录即可取得独立会话；无需清空浏览器数据或重新配置系统。
