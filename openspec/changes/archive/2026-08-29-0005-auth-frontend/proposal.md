## Why

后端 `auth-module` 已于 2026-08-29 归档（22 个主类 / 12 个测试类 / 100 测试全绿），提供 8 个认证端点与完整的四态状态机。但**前端完全没有登录注册代码**——全量搜索 `login|register|signin|signup|password|credential` 零命中，`frontend/app/` 只有首页骨架路由，`components/` 只有 homepage 与 3 个基础 UI 件。

结果是：后端能力齐全，用户却无法注册、无法登录。`project.md` 规划的个人中心、消息通知、站内信全部依赖用户身份，身份入口不落地，这些能力都无法开始。

从前端视角反推后端 API 时还暴露两处阻塞：

1. **后端零 CORS 配置**——前端默认 `localhost:3000` 与后端 `localhost:8080` 不同源，浏览器将拦截全部请求。这是前提性阻塞项，不解决则页面写得再好也发不出一个请求。
2. **密码重置缺失**——登录页几乎必然需要「忘记密码」入口，而 `auth-module` 当初以「会引入新的敏感字段与邮件模板」为由列为 Out of Scope。但邮箱验证链路建成后，密码重置的边际成本已大幅下降（同构机制：发一次性码 → 免鉴权链接 → 校验）。

## What Changes

### 前端变更（主体）

- **新增页面路由**（Route Group `(auth)` 承载统一认证布局）：
  - `/register` 注册页
  - `/login` 登录页
  - `/forgot-password` 忘记密码页
  - `/auth/verify` 邮箱验证结果页
  - `/auth/reset-password` 密码重置页
- **表单方案**：引入 `react-hook-form` + `zod` + `@hookform/resolvers`，schema 与后端约束逐字段对齐（含密码 8–72 上限）
- **新增 shadcn 组件**：`label` / `card` / `form` / `alert`（当前 `components/ui/` 仅 `button` / `input` / `skeleton`）
- **认证客户端模块**：封装请求拼装、Bearer 令牌注入、统一错误信封解析；仅做传输与解析，不含业务逻辑
- **会话管理**：Token 存 `localStorage`；`GET /me` 恢复会话；access 过期时经 `/refresh` 静默续期并重放原请求
- **路由保护**：客户端守卫（token 在 localStorage，middleware 读不到）
- **测试**：Vitest + RTL 覆盖表单校验、错误分支、加载态与防重复提交

### 后端变更（配合项）

| # | 改动 | 必要性 |
|---|---|---|
| 1 | CORS 配置（可配来源，非 `*`） | **阻塞项** |
| 2 | 新增 `POST /forgot-password`、`POST /reset-password` | 高 |
| 3 | `User` 新增 `passwordResetCode`、`passwordResetCodeExpiresAt`、`passwordChangedAt` | 高 |
| 4 | 令牌失效：`iat` 早于 `passwordChangedAt` 即判失效 | 高 |
| 5 | `password` 增加 `max=72` | 高 |
| 6 | 邮件链接指向前端（需配置前端 base URL） | 中 |
| 7 | 新增错误码 `INVALID_RESET_CODE`、`TOKEN_INVALIDATED` | 中 |
| 8 | 两个重置端点限流（`forgot-password` 与 `resend-verification` 取齐；`reset-password` 10 次/小时） | 中 |
| 9 | `423` 响应附 `retryAfterSeconds` | 低 |
| 10 | 密码变更通知邮件（`MailSender` 新增方法 + 模板；投递失败仅记日志，不回滚重置） | 中 |

### 明确不包含（Out of Scope）

- ❌ **OAuth / 社交登录**（Google / Apple / WeChat）
- ❌ **MFA / 2FA**
- ❌ **个人中心 / 消息通知 / 站内信页面**——依赖本 change 的身份基础，由后续 change 承载
- ❌ **真实 SMTP 邮件投递**——沿用 `LoggingMailSender`，接口已预留
- ❌ **BFF 代理 + httpOnly Cookie 改造**——已评估，见 design.md 演进路径
- ❌ **邮箱实时查重 `check-email`**——与「精确状态码 + 限流」的防枚举路线直接冲突
- ❌ **独立 `introspect` 端点**——`/me` 已覆盖且顺带返回用户信息
- ❌ **「密码已变更」通知邮件**——安全最佳实践，但需额外邮件模板，留待后续

### 规格变更

- 新增 `openspec/specs/auth-frontend/spec.md`
- 修订 `openspec/specs/auth-module/spec.md`（安全边界扩展、新增重置端点）

## Capabilities

### New Capabilities

- `auth-frontend`：定义 WanderChina 前端注册 / 登录 / 邮箱验证 / 密码重置的页面契约、表单校验规则、Token 生命周期管理与前端错误分支策略；并从前端消费视角固化后端认证 API 的字段与响应契约。

### Modified Capabilities

- `auth-module`：新增密码重置端点与对应实体字段；安全边界扩展至 `passwordResetCode` 与 `passwordChangedAt`；新增密码变更导致令牌失效的机制；新增两个错误码；补充 CORS 与密码长度上限。

## Impact

- **前端依赖**：新增 `react-hook-form`、`zod`、`@hookform/resolvers` 三个运行时依赖，以及 shadcn 的 `label` / `card` / `form` / `alert` 组件。当前项目无表单库，这是首次引入。
- **后端依赖**：无新增（CORS 由 `spring-boot-starter-web` 提供）。
- **安全**：
  - 正面——密码重置使变更前的令牌全部失效，阻断攻击者持旧令牌持续访问；重置端点恒定 `202` 防账号枚举；安全边界自动覆盖新增敏感字段。
  - 需知——Token 存 localStorage 存在 XSS 窃取面（已评估并接受，缓解措施见 design.md）。
- **跨模块**：本 change 是个人中心 / 消息通知 / 站内信的前置依赖；认证客户端模块将成为这些模块的公共调用入口。
- **约束合规**：符合 `project.md`「业务逻辑一律在后端」原则——前端仅做传输、解析与展示，状态判断与密码校验全在后端。
- **团队**：引入 `react-hook-form` + `zod` 需少量学习成本，二者均为主流方案且与 shadcn `form` 组件天然集成。

## Open Questions

- [x] 前端需补充 shadcn 组件 `label` / `card` / `form` / `alert` —— **已定**：通过 shadcn CLI 添加
- [x] 密码重置码有效期 —— **已定**：1 小时（短于邮箱验证的 24 小时，因重置码敏感度更高）
- [x] 重置成功后发送「密码已变更」通知邮件 —— **已定**：发送；投递失败不回滚重置结果
- [x] `forgot-password` 限流阈值 —— **已定**：与 `resend-verification` 取齐（IP 10 次/小时、(IP+email) 3 次/24 小时）
