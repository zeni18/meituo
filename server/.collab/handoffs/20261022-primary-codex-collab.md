# 本地环境记录 · 2026-10-22

本文仅保留环境事实。此前的智能体分工、文件归属、共享文件审批和固定集成流程已按用户要求删除。开工前和完工后的 GitHub 同步由用户指示当前 AI 执行，见 `.collab/README.md`。

- GitHub：`https://github.com/yfl117/meituo-ai-marketing`。
- 原有运行项目：`D:\AI营销中台\likeadmin-aigc`，网页端口 8090。
- GitHub 工作目录：`D:\meituo-dev\project`，开发网页配置 8094、数据库 3311。
- 另一个已建环境：`D:\meituo-dev\worktrees\deepseek`，开发网页配置 8091、数据库 3312；本记录不将该目录的修改视为已验收内容。
- `D:\meituo-dev\bootstrap` 仅用于引导安装。
- 启动前确认端口与对应目录，勿停掉未知服务；本次同步不启动生成、发布或采集 worker。
- `.env`、账号、密钥、数据库、上传素材及本机运行目录不进入 GitHub。环境之间不共用数据库。
- 浏览器的 localhost Cookie 不按端口隔离；测试不同环境时使用分离的浏览器会话。

以上端口是配置记录，不表示服务始终运行。验收时重新确认服务状态。
