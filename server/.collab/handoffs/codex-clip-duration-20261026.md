# 线上剪辑素材时长不可用

用户提供截图：一键成片工程已保存第4版，4个短视频，生成面板报「视频时长不可用」。已修复线上运行环境及探测错误处理，未提交或推送 GitHub。

## 根因与实证

生产没有 ffprobe/ffmpeg 可执行文件，也未配置 MERCHANT_CLIP_FFPROBE。ClipMediaProbe 因进程没有有效输出而返回 null；相同工程2（tenant_id=1/user_id=1/revision=4）引用素材5/6/7/8的服务端 duration 全部为空。没有已保存编排或云任务，失败在提交云生成之前。

不是用前端的示意时长代替真实时长。补齐组件后，原素材实测分别为：5=6.566667秒、6=12.466667秒、7=18.933333秒、8=4.5秒。清除这四个文件对应的派生时长缓存后再次探测，仍正常。直接使用原工程配置和实际素材做12个确定性种子的 ClipPlanner + ClipImsTimeline 验证，目标10–15秒、源裁剪不越界、片段时长为正均通过。没有保存测试编排、修改客户工程/素材，也没有创建/提交测试云任务。

## 环境与源码

组件：/www/wwwroot/ai.zoco2.com/shared/tools/ffprobe-8.1-20261025/bin/ffprobe。实际版本 n8.1.3-24-g92611900bb-20261025。该站 shared/.env 的 [MERCHANT_CLIP] 增加 FFPROBE 绝对路径，原有 CONFIG_KEY 等配置保留；七项云能力仍为 configured。没有修改全局 PATH、系统共享库或 master.siroc.cn。

来源为 BtbN/FFmpeg-Builds 的 Linux LGPL 静态发行包；维护者说明支持 glibc>=2.28，服务器为x86_64/glibc2.34，实测可执行。已保留 LICENSE.txt 与 provenance.json。包及文件摘要：

- 上游包 SHA256：6bc24b805361c11efe93eb564bd4a3904a9ec412591e06dd4326cd22bb7d1ca9。
- ffprobe SHA256：be33c64b344618b16e2fce8f544727d1a7600c75cda72a518285b575ea83fe7c。
- 传输用单二进制XZ SHA256：5180bafeb1745df6bc83e1390297506eff2ea9efa856701020c7075527267562。

服务器无法直接访问 GitHub 下载域名，因此在本机 D: 下载并校验原包，通过已有授权 SSH 会话分块传输组件。没有为此新增 SSH 密钥或索要新密码。传输后先核验压缩包、解压文件及版本，再修改站点环境配置。

ClipMediaProbe.php 改动：读取 format.duration，缺失时回退到合法音视频 stream.duration；不接受空值、非数字、非正数或失败进程的部分输出。明确区分组件启动失败/缺失与超时；兼容 PHP8.2 proc_get_status 读取后 proc_close=-1 的情况。ffprobe 限制 protocol_whitelist=file，继续保留上传路径边界、归属检查和成功结果缓存。不修改剪辑布局、原生口播、计费及供应商请求逻辑。

## 剪辑队列

原生产没有商家剪辑 worker，会在修复编排后留下无人消费的队列。因此本轮新增并启用 ai-zoco2-clip-worker.service，以 www 运行 php think merchant-clip:work，仅处理该站商家剪辑/相关声音任务；未启用 GEO、发布或其他生成 worker。启用前两张任务表均为空；没有人工构造云生成任务。服务 active/running/enabled、NRestarts=0，无 Queue unavailable/PHP fatal 日志。原媒体目录服务与每日同步定时器仍 active。

## 验证与限制

tests/clip-media-probe.contract.php 的26项检查通过，包括小数时长、流时长回退、无效元数据、进程失败诊断、PHP8.2退出码、缓存、远程/越界文件和本地协议限制。线上以 www 执行真实探测及12组编排/时间线校验通过。OSS/IMS配置就绪不等于供应商生成已实测；本轮未提交付费云生成。浏览器生产权限仍被已保存规则拒绝，没有通过其他浏览器、无头工具或CDP绕过，视觉验收待补。

## 回滚与证据

本机源码备份：.collab/local/ui-v2-backup/20261026-clip-duration/。

线上环境/源码备份与摘要：/root/ai-zoco2-deploy/20261024-1442/clip-duration-20261026-133654/，包含 env.before（600权限）、ClipMediaProbe.before.php、result.json、code-result.json、worker-verification.json。环境文件是shared/.env，不要用普通文件替换 current/.env 的符号链接。回滚前先核对当前摘要，保留之后的新改动。

运行验证：shared/runtime/config-migration-20261024/clip-duration-baseline-20261026.json 与 clip-duration-verified-20261026.json；审计脚本为同目录 audit-clip-duration-20261026.php / verify-clip-runtime-20261026.php，需 www 执行。

新 systemd unit：/etc/systemd/system/ai-zoco2-clip-worker.service；本机暂存同名文件位于 D:/AI营销中台/_sync/server-ai-zoco2-20261024/。unit SHA256 ca37817c5f15a027fc4f1c80188f09172789bd094fcdba70977d954a687723f2。回滚 worker 前先核查是否有用户正在执行的真实任务，不盲目中断。

来源记录：[BtbN构建说明](https://github.com/BtbN/FFmpeg-Builds)、[ffprobe文档](https://ffmpeg.org/ffprobe.html)。此前服务商后台404仍待用户回复具体发生步骤；本次没有盲改后台路由。
