# 登录页参考风格优化

范围：当前商家登录页 `/login`、平台 `/platform/login`、OEM/代理统一入口 `/admin/login`。

按用户提供的图采用左侧淡蓝品牌栏、欢迎文案和本地 SVG 业务插画，右侧留白及 400px 登录表单。蓝色用于提交、复选和焦点；输入框采用细边框和小圆角。移动端品牌栏收为页眉，表单保持正常滚动。深色模式通过同一组语义变量控制背景、输入框、文字、按钮和错误状态。

商家名称、标识及版权继续读取现有租户配置；管理端继续读取原公共配置，保留自定义登录图片。共享脚本只增强登录页展示，原 Vue 表单和提交监听原位保留，不读取密码、令牌，不改登录接口、验证、记住账号和跳转。参考图中的第三方品牌、注册与 SSO 等入口不复制。

代码：`public/shared/login.css`、`login.js`、`login-workspace.svg`。管理端原 Vue 源码尚未提供，因此通过 HTML 入口加载独立展示层；未来重建管理端入口时须保留这两个资源引用。未改动编译后的认证模块。

验证：原 `tests/merchant-oem.http.php` 的 37 项检查通过，涵盖实际商家登录、会话、未登录/伪造访问、同源限制及退出；本地 QA OEM 会话过期后通过原登录接口续签再运行。JS/PHP 语法与差异检查通过（仅仓库原有 `.gitignore` 换行提示）。浏览器核对三端布局、管理端原生必填校验、明暗主题和字段标签；通过 390×844 的真实登录 iframe 检查长品牌名称，内容宽度与视口均为 390，无横向溢出，临时验收页面已移除。

截图位于 `runtime/local/evidence/login-reference-light.png`、`login-reference-dark.png`、`login-reference-mobile.png`、`login-oem-reference-light.png`。未调用 AI 服务，未更改计费、权限和登录认证契约。
