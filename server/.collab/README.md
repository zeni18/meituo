# 环境搭建与 GitHub 同步

代码仓库：[yfl117/meituo-ai-marketing](https://github.com/yfl117/meituo-ai-marketing)（私有）。两台电脑各自运行项目，GitHub 同步代码；Tailscale 仅用于互看页面。

## 日常同步

用户在开工前让当前 AI 拉取最新代码，完工后让当前 AI 提交并推送。按用户当次指令执行，不设置智能体分工、文件归属或集成审批。

在项目根目录运行：

```powershell
.collab/sync.ps1 -Action status
.collab/sync.ps1 -Action begin
# 完成修改，检查后只暂存本次任务文件，并提交。
.collab/sync.ps1 -Action publish
```

`begin` 在当前分支执行 `pull --ff-only`，`publish` 推送当前分支；也支持 `pull`、`push` 别名。拉取和推送前要求工作区干净，远端领先或分支分歧时停止，不丢弃本地代码、不强推。不自动创建按机器或 AI 命名的分支。凭据审计继续执行。

## 首次搭建

1. 安装 Git、GitHub CLI、Node.js LTS；已有时无需重复安装。
2. 用 `gh auth login --hostname github.com --git-protocol https --web` 登录有仓库访问权的账号。
3. 克隆引导目录：`gh repo clone yfl117/meituo-ai-marketing D:\meituo-dev\bootstrap`。
4. 在尚不存在的新目录搭建，避免覆盖已有项目：

```powershell
powershell -ExecutionPolicy Bypass -File D:\meituo-dev\bootstrap\.collab\setup-machine.ps1 -Role primary -Destination D:\meituo-dev\project -ProvisionRuntime
```

`Role` 是现有安装脚本的机器配置参数，不决定代码权限或任务分工。`-ProvisionRuntime` 从私有仓库 release 下载便携运行时并校验 SHA-256，初始化独立开发库。已有运行时可按 `.collab/setup-runtime.ps1 -RuntimePackage <解压目录>` 配置。

5. 启动：`.collab/start-web.ps1 -Port 8090`，打开 `http://localhost:8090/login`。端口被占用时先确认归属，再选空闲端口。测试账号位于本机忽略文件 `.collab/local/accounts.txt`。
6. 确认登录、工作台及 `/api/merchant/session`。本机端口与运行时以 `.collab/local` 配置为准。

## 本地数据与运行

- `.env`、数据库、会话、上传素材、API 密钥、账号文件及运行时不进 Git。每台电脑使用独立数据库；结构变化提交迁移文件，备份后分别执行。
- `.collab/seed/schema.json` 只是首次搭建的结构快照，后续不自动更新。
- `start-web` 只启动数据库与网页，不自动启动生成、发布、采集或同步 worker。
- `public/merchant/` 已纳入 Git，修改前仍备份到 `.collab/local/ui-v2-backup/<时间>/`。
- 从旧目录迁移时比较明确文件，不整目录覆盖已有改动。

### 2026-10-27 同步后的会话结构升级

本次代码包含多设备独立登录。已有开发库首次运行新版前，先备份本机三张会话表的结构和记录，再使用本机 PHP 执行：

```powershell
.collab/runtime/php/php.exe scripts/migrate-multi-device-sessions.php
.collab/runtime/php/php.exe scripts/migrate-multi-device-sessions.php --apply
```

第一条只检查，第二条把账号/终端的唯一索引改成普通索引，保留 token 唯一索引及原会话记录；重复执行不会重复改动。脚本同时检查现有会话分表。每台电脑独立执行，不复制另一台电脑的数据库、账号或会话。新安装已使用新版表结构。

生产库必须先独立备份并明确指定 `--expected-db=<实际库名>`；不要直接在生产执行本机开发库测试。ai.zoco2.com 已在 2026-10-26 完成此升级，具体证据见 `.collab/handoffs/codex-multi-device-login-20261026.md`。

## 互看页面

两台电脑加入同一个 Tailscale 私人网络，提供页面的一台运行 `.collab/share-preview.ps1`，查看的一台运行 `.collab/connect-preview.ps1 -Peer <对方 Tailscale 地址>`，随后打开 `http://localhost:18091/login`。停止分享使用 `.collab/share-preview.ps1 -Stop`。数据库不开放到公网。
