# GEO DeepSeek Flash

2026-10-19：用户确定 AI拓词、文章生成、改写统一先使用 DeepSeek Flash，已有官方 Key、稍后在后台填写。本次完成代码、目录登记、配置界面及离线验收，未填写真实 Key、未发生外部付费生成。

## 开通步骤

1. 总后台 **接入能力配置 → AI拓词 / 文章生成 / 改写**：选“本级自配”和“DeepSeek Flash 官方直连”，填写官方 Key 保存。产品 ID 自动带出，固定模型 `deepseek-flash`，不用输入域名或修改全局上游。
2. 原算力市场找到 **DeepSeek Flash（GEO官方直连）**，维护输入、输出两个 SKU（每百万 Token）的平台售价，并在 OEM 设置其销售价格。两个计费项都需上架。安装不自动设定供应商成本、零售利润或免费调用；供应商实际费用及缓存折扣以官方账户账单为准，本系统按所设原市场 Token 售价计费。
3. 如 OEM 统一借用平台账号：平台逐项授予该 OEM 使用权限，OEM 将此能力设为“借用平台配置”。代理仍需 OEM 授权使用；没有自动扩大已有借权。OEM 也可配置自己的官方 Key。
4. 保存后点“检查 DeepSeek 连接与余额”，只调用官方余额接口，不生成文章、不提交诊断。正式试用由用户在商家端确认文本费用后提交小任务，再核对结果、实际 Token 与原消费单。

## 接口与计费

- 官方生成：`POST https://api.deepseek.com/chat/completions`，Bearer Key，`model=deepseek-flash`、`thinking.type=disabled`、非流式响应，单次最多8192输出 Token。快速诊断和自动化写作沿用其2048上限。
- 拓词、文章、改写使用 `response_format.type=json_object`；企业知识字段整理使用纯文本。仅发送模型请求字段，不向官方发送内部市场/商家ID或账单字段。
- 密钥只存在 GEO 加密凭证与服务端传输闭包；不写入队列载荷、原生请求摘要或商家结果。固定官方 HTTPS 主机，校验证书，不跟随跳转。
- 原 `MarketTextModelRuntimeService` 负责原生任务、消费、Token 用量结算及自动化预算钩子。服务器可选传输和执行范围不会从浏览器参数读取。专用模型只对 GEO 显示，其他原应用继续使用原上游；原上游模式及其他模型协议保持兼容。
- 实际输入/输出用量来自官方响应。用量缺失、输出截断、超时或响应不明进入待核对并保留结果，不自动重发；明确鉴权/参数/余额拒绝关闭原消费，不产生虚构成功内容。重新生成仍由用户明确提交。

官方文档：[调用说明](https://api-docs.deepseek.com/)、[生成接口](https://api-docs.deepseek.com/api/create-chat-completion/)、[JSON输出](https://api-docs.deepseek.com/guides/json_mode/)、[余额接口](https://api-docs.deepseek.com/api/get-user-balance/)。

## 安装与验证

单独登记目录运行 `php scripts/install-geo-deepseek.php`；总 GEO 能力安装器也包含此登记。幂等保留已有售价与上下架，不覆盖 Key 或授权。无新增数据表。更新 PHP 与管理端静态文件后，在队列空闲时重启 `merchant-geo:work` 和 `merchant-automation:work`。

已通过回滚离线检查：DeepSeek75项、旧GEO能力68项、快速诊断34项、服务商诊断57项、原监测74项、自动化35项，共343项。包含三项实际原生消费与钱包结算、结果入库、专用模型隔离、原任务幂等、明确拒绝、未知响应、使用授权及自动化预算。

额外运行原系统模型协议测试时，3项既有契约测试仍失败：Claude Messages 对比、Agent预检源码固定字符串、温度兼容重试源码固定字符串。对照 Git HEAD 确认相关请求体/温度方法结果一致，Agent提供器未修改；本次未更改这些既有行为或测试断言。多模态模型契约通过。它们不作为本次 DeepSeek 直连成功的证明，实际联调仍待填入 Key 与售价。
