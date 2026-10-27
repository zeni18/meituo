# 新电脑接入说明

代码仓库：[yfl117/meituo-ai-marketing](https://github.com/yfl117/meituo-ai-marketing)（私有）。先检查本机项目与未提交改动，再按 `.collab/README.md` 搭建；不要覆盖已有目录。

1. 确认 `gh auth status` 对应有仓库访问权的账号。
2. 用 `.collab/setup-machine.ps1 -Role primary -Destination D:\meituo-dev\project -ProvisionRuntime` 在新目录搭建。`Role` 仅为安装脚本参数。
3. 若需单独下载便携运行时：

```powershell
gh release download dev-runtime-20261022 --repo yfl117/meituo-ai-marketing --pattern meituo-windows-runtime.zip --dir D:\meituo-dev\downloads
Expand-Archive -LiteralPath D:\meituo-dev\downloads\meituo-windows-runtime.zip -DestinationPath D:\meituo-dev\runtime-package
```

4. 已下载的运行时可使用 `.collab/setup-runtime.ps1 -RuntimePackage D:\meituo-dev\runtime-package -DbPort 3311` 配置，使用 `.collab/start-web.ps1 -Port 8090` 启动。端口以本机实际配置为准，不停止未知服务。
5. 初始化只创建独立开发库、表结构及筛选后的菜单和应用目录；不包含另一台的业务数据、素材、密钥或会话。测试账号在 `.collab/local/accounts.txt`，不得提交或回传密码。
6. 验证登录、工作台及 `/api/merchant/session`。后续由用户在开工前让当前 AI 拉取最新代码，完工后让当前 AI 提交并推送；同步命令见 README。
7. 互看页面使用 Tailscale 及 `.collab/share-preview.ps1`、`.collab/connect-preview.ps1`；不开放数据库端口到公网。

旧目录后续修改需逐文件比较后迁移；GitHub 仅同步已经提交并推送的代码。
