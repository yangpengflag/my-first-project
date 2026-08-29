# auth-frontend Specification

## Purpose
WanderChina 前端认证模块规范：覆盖注册 / 登录 / 邮箱验证 / 忘记密码 / 密码重置 / 令牌存储与续期 / 路由保护 / 跨域边界的完整前端契约。约束与后端 `auth-module` 规范逐字段对齐，令牌存于 localStorage（Bearer 设计），错误响应按统一 `error.code` 分支。
## Requirements
### Requirement: 注册 API 与注册页面

`POST /api/auth/register` SHALL 接受 `{email, password, displayName}` 并以 `EMAIL_UNVERIFIED` 状态创建用户，**不签发任何令牌**。前端 SHALL 提供 `/register` 页面，注册成功后引导用户查收验证邮件而非跳转首页。

#### Scenario: 注册成功返回 201 且不含令牌

- **WHEN** `POST /api/auth/register` 提交合法 `{email, password, displayName}`
- **THEN** 返回 `201 Created`
- **AND** 响应体 `status` 为 `"EMAIL_UNVERIFIED"`
- **AND** 响应体**不**包含 `accessToken` / `refreshToken`
- **AND** 响应体**不**包含 `passwordHash` / `salt` / `verificationCode` / `passwordResetCode`（任一命名形式）

#### Scenario: 前端注册页提交后引导验证邮箱

- **WHEN** 用户在 `/register` 提交表单且后端返回 `201`
- **THEN** 页面切换为「请查收验证邮件」状态并展示用户邮箱
- **AND** 提供「重发验证邮件」按钮
- **AND** **不**自动跳转首页（用户尚未激活）

#### Scenario: 邮箱重复返回 409

- **GIVEN** `alice@example.com` 已注册（含已注销账号）
- **WHEN** 以该邮箱（或任意大小写变体）提交注册
- **THEN** 返回 `409 Conflict`，`error.code` 为 `"EMAIL_ALREADY_REGISTERED"`
- **AND** 前端在邮箱字段下方提示「该邮箱已注册」并引导登录

#### Scenario: 参数非法返回 400

- **WHEN** 提交的 `password` 不在 8–72 字符区间，或 `email` 格式非法
- **THEN** 返回 `400 Bad Request`，`error.code` 为 `"VALIDATION_FAILED"`
- **AND** `error.details` 为逐字段说明数组，前端据此高亮对应输入框

#### Scenario: 提交中的加载与防重复提交

- **WHEN** 注册请求进行中
- **THEN** 提交按钮 disabled 并显示加载指示，重复点击不产生第二次请求

---

### Requirement: 登录 API 与登录页面

`POST /api/auth/login` SHALL 依据用户状态返回精确响应码，前端 SHALL 按 `error.code` 分支而非仅看 HTTP 状态码。

| 用户状态 | HTTP | `error.code` | 前端动作 |
|---|---|---|---|
| `ACTIVE` | `200` | — | 存令牌，跳转首页 |
| `LOCKED` | `423` | `ACCOUNT_LOCKED` | 提示锁定，展示倒计时 |
| `DELETED` | `401` | `ACCOUNT_DELETED` | 提示账号已注销 |
| `EMAIL_UNVERIFIED` | `403` | `EMAIL_NOT_VERIFIED` | 提示先验证邮箱 + 重发按钮 |
| 邮箱不存在 / 密码错误 | `401` | `INVALID_CREDENTIALS` | 通用「邮箱或密码错误」 |

#### Scenario: 登录成功返回 200 并签发令牌

- **WHEN** `POST /api/auth/login` 提交已激活用户的正确密码
- **THEN** 返回 `200 OK`，含非空 `accessToken` 与 `refreshToken`
- **AND** 响应体 `user.status` 为 `"ACTIVE"`
- **AND** 响应体**不**包含任何凭证类字段

#### Scenario: 未验证邮箱登录返回 403 且前端提供出路

- **WHEN** `EMAIL_UNVERIFIED` 用户提交**正确**密码
- **THEN** 返回 `403 Forbidden`，`error.code` 为 `"EMAIL_NOT_VERIFIED"`
- **AND** 前端展示「请先验证邮箱」并内联提供「重发验证邮件」按钮
- **AND** 点击重发调用 `POST /api/auth/resend-verification`（免鉴权，恒定 `202`）

> 该按钮是破解死锁的关键出口：未验证用户拿不到令牌，只能经此免鉴权链路激活。

#### Scenario: 账号锁定返回 423 且可倒计时

- **WHEN** `LOCKED` 用户提交任意密码
- **THEN** 返回 `423 Locked`，`error.code` 为 `"ACCOUNT_LOCKED"`
- **AND** 响应体含 `retryAfterSeconds`（见「后端配合项」）
- **AND** 前端据此展示倒计时；字段缺失时退化为静态文案

#### Scenario: 登录页提供忘记密码入口

- **WHEN** 渲染登录页
- **THEN** 展示「忘记密码？」链接，跳转 `/forgot-password`

#### Scenario: 登录失败不透露邮箱是否存在

- **WHEN** `error.code` 为 `INVALID_CREDENTIALS`
- **THEN** 前端统一展示「邮箱或密码错误」

---

### Requirement: Token 验证与会话维持

前端 SHALL 通过 `GET /api/auth/me` 校验本地令牌是否仍有效，并在 access token 过期时经 `POST /api/auth/refresh` 静默续期。

> **决策**：不新增独立 `introspect` 端点。`/me` 已完成校验且顺带返回用户信息（前端刷新时本就需要）；`introspect` 的 RFC 7662 语义（无效令牌也返回 `200 {active:false}`）服务于第三方接入方，本项目无此场景。

#### Scenario: 刷新页面时用 /me 恢复会话

- **GIVEN** 本地存有 access token
- **WHEN** 应用启动或页面刷新
- **THEN** 前端以 `Authorization: Bearer <token>` 调用 `GET /api/auth/me`
- **AND** `200` → 视为已登录并写入用户信息
- **AND** `401` → 清除本地令牌，视为未登录

#### Scenario: /me 反映状态实时变化而非仅令牌有效性

- **GIVEN** 用户持有效令牌，但账号在此期间被锁定或注销
- **WHEN** 调用 `GET /api/auth/me`
- **THEN** 分别返回 `423 ACCOUNT_LOCKED` 或 `401 ACCOUNT_DELETED`
- **AND** 前端清除本地令牌并提示对应原因

#### Scenario: 密码变更后旧令牌失效

- **GIVEN** 用户密码已通过重置流程变更
- **WHEN** 使用该变更**之前**签发的任意令牌调用需鉴权端点
- **THEN** 返回 `401`，`error.code` 为 `"TOKEN_INVALIDATED"`
- **AND** 前端清除本地令牌并跳转登录页提示「请重新登录」

> 依据：用户 JWT 携带 `iat`。后端比对 `iat` 与用户 `passwordChangedAt`，令牌签发早于密码变更即判失效。这是防止攻击者持旧令牌持续访问的关键。

#### Scenario: access token 过期时静默续期

- **GIVEN** access token 已过期、refresh token 仍有效
- **WHEN** 任意需鉴权请求返回 `401 UNAUTHENTICATED`
- **THEN** 前端以 refresh token 调用 `POST /api/auth/refresh`
- **AND** 成功则更新本地 access token 并**重放**原请求
- **AND** refresh 失败则清除令牌并跳转登录页

#### Scenario: refresh 端点响应

- **WHEN** `POST /api/auth/refresh` 提交有效 refresh token
- **THEN** 返回 `200` 及新签发的 access / refresh token
- **AND** 用户为 `DELETED` 返回 `401 ACCOUNT_DELETED`；为 `LOCKED` 返回 `423 ACCOUNT_LOCKED`；令牌早于密码变更返回 `401 TOKEN_INVALIDATED`

---

### Requirement: 邮箱验证结果页

验证邮件中的链接 SHALL 指向**前端页面** `/auth/verify?code=<code>`，由前端调用后端 `GET /api/auth/verify?code=` 完成激活，而非让用户直接访问后端 API 地址。

#### Scenario: 验证成功展示成功态

- **GIVEN** 用户点击邮件中的 `/auth/verify?code=<有效code>`
- **WHEN** 页面挂载并调用 `GET /api/auth/verify?code=`
- **THEN** 后端返回 `200`，用户状态转 `ACTIVE`
- **AND** 前端展示「邮箱验证成功」并提供跳转登录页入口

#### Scenario: 验证失败展示失败态与重试

- **WHEN** `code` 无效 / 已过期 / 已使用
- **THEN** 后端返回 `400 INVALID_VERIFICATION_CODE`（三态同码，不泄露具体原因）
- **AND** 前端展示「验证链接无效或已过期」并提供「重发验证邮件」入口

#### Scenario: 验证进行中的加载态

- **WHEN** 验证请求进行中
- **THEN** 页面展示加载指示，不闪烁错误态

---

### Requirement: 忘记密码与密码重置

系统 SHALL 提供免鉴权的密码重置链路，与邮箱验证同构（发一次性码 → 邮件链接指向前端 → 前端提交新密码），并 SHALL 使密码变更前的令牌失效。

| 端点 | 鉴权 | 成功 | 说明 |
|---|---|---|---|
| `POST /api/auth/forgot-password` | 免 | `202` | 恒定成功，防账号枚举 |
| `POST /api/auth/reset-password` | 免 | `200` | 凭一次性码设置新密码 |

#### Scenario: 请求重置返回恒定 202

- **WHEN** `POST /api/auth/forgot-password` 提交任意邮箱
- **THEN** 无论邮箱是否存在、是否已注销，**均**返回 `202 Accepted`
- **AND** 仅当邮箱存在且状态**非** `DELETED` 时才实际投递邮件
- **AND** 响应体为固定文案，不透露该邮箱是否已注册

#### Scenario: 一次性码有时效且用后即焚

- **WHEN** 密码重置码生成
- **THEN** 有效期为 1 小时（短于邮箱验证的 24 小时，因重置码敏感度更高）
- **AND** 成功使用后立即置空，重复提交同一码返回 `400`

#### Scenario: 有效码重置密码成功

- **WHEN** `POST /api/auth/reset-password` 提交有效 `code` 与合法 `newPassword`
- **THEN** 返回 `200 OK`
- **AND** 用户密码更新为 `newPassword`，重置码置空
- **AND** 用户 `passwordChangedAt` 更新为当前时刻
- **AND** 该用户 `failedAttempts` 归零（重置即解除可能的锁定）

#### Scenario: 无效或过期码返回 400

- **WHEN** 提交无效 / 已过期 / 已使用的 `code`
- **THEN** 返回 `400`，`error.code` 为 `"INVALID_RESET_CODE"`
- **AND** 三态共用同一错误码，不泄露码是否曾存在、是否已使用或是否已过期

#### Scenario: 重置成功一并把未验证邮箱置为已激活

- **GIVEN** 用户状态为 `EMAIL_UNVERIFIED` 且走完重置流程
- **WHEN** 重置成功
- **THEN** 用户状态变更为 `ACTIVE`

> 依据：用户能收到重置邮件本身即证明邮箱可达，等同于完成验证。若不激活，用户重置后仍被 `403` 挡在门外，属明显体验缺陷。

#### Scenario: 重置成功后发送变更通知邮件

- **WHEN** 密码重置成功
- **THEN** 系统向用户邮箱投递一封「密码已变更」通知
- **AND** 通知内容**不**包含新密码、重置码或任何其他凭证
- **AND** 通知投递失败**不**影响重置结果（重置已完成，失败仅记录日志）

> 依据：非本人发起的密码重置必须让用户及时察觉，这是账号安全的标准做法（OWASP 推荐）。

#### Scenario: 重置密码受长度约束

- **WHEN** 提交的 `newPassword` 不在 8–72 字符区间
- **THEN** 返回 `400 VALIDATION_FAILED`
- **AND** 前端表单即时校验阻止提交

#### Scenario: 重置端点限流

- **WHEN** 同一 IP 在 1 小时内提交超过 10 次 `reset-password`
- **THEN** 返回 `429 RATE_LIMITED`（防重置码爆破）

#### Scenario: 申请重置限流与重发验证取齐

- **WHEN** 同一 IP 在 1 小时内提交超过 10 次 `forgot-password`
- **THEN** 返回 `429 RATE_LIMITED`
- **AND** 同一 (IP + email) 在 24 小时内超过 3 次同样返回 `429`

> 阈值与 `resend-verification` 完全一致（IP 10 次/小时、(IP+email) 3 次/24 小时），
> 避免两个语义相近的端点各自维护一套数字而产生漂移。

#### Scenario: 前端重置页流程

- **WHEN** 用户访问 `/auth/reset-password?code=<code>`
- **THEN** 展示新密码输入表单（含确认输入，两者须一致）
- **AND** 提交成功后展示成功态并跳转登录页

---

### Requirement: Token 存储与生命周期

前端 SHALL 将 access / refresh token 存于 `localStorage`，登出时清除。

> **已决策的权衡**：后端为 Bearer 设计（`JwtAuthFilter` 读 `Authorization` 头），前端 JS 必须能取到令牌，故无法使用 httpOnly Cookie。
> - 代价一：XSS 场景下令牌可被窃取（缓解：React 默认转义，禁用 `dangerouslySetInnerHTML`）
> - 代价二：Next.js middleware（Edge Runtime）读不到 localStorage，路由保护只能在客户端组件内实现
> - 演进路径：如需更高安全，改为 BFF 代理 + httpOnly Cookie，届时需后端支持从 Cookie 读取令牌

#### Scenario: 登出清除本地令牌

- **WHEN** 用户点击登出
- **THEN** 前端调用 `POST /api/auth/logout`
- **AND** 无论后端响应如何，均清除本地 access / refresh token
- **AND** 跳转首页

#### Scenario: 令牌不写入日志或 URL

- **WHEN** 应用运行期间的任意时刻
- **THEN** access / refresh token **不**出现在 URL query string、控制台日志或任何持久化日志中

---

### Requirement: 表单校验与前后端约束对齐

前端 SHALL 使用 `react-hook-form` + `zod` 实现表单，schema 约束与后端权威校验**逐字段一致**。

| 字段 | 约束 | 说明 |
|---|---|---|
| `email` | 必填；合法格式；≤ 254 字符 | 后端小写归一化后判唯一 |
| `password` / `newPassword` | 必填；**8–72 字符** | 72 上限来自 BCrypt 字节截断 |
| `displayName` | 必填；1–64 字符 | |

#### Scenario: zod schema 与后端约束一致

- **WHEN** 定义注册 / 登录 / 重置密码表单 schema
- **THEN** `email`、`password`、`displayName` 的约束与上表**逐项一致**
- **AND** 前端校验属即时反馈，**不**替代后端校验（后端保持权威）

#### Scenario: 密码长度上限为 72

- **WHEN** 提交长度 > 72 字符的密码
- **THEN** 前端即时阻止提交并提示
- **AND** 后端同样返回 `400 VALIDATION_FAILED`

> **依据**：BCrypt 仅处理前 72 字节，超出部分被静默丢弃。超长密码会造成「密码很强」的错误认知，且各语言截断行为不一致（UTF-8 中文占 3 字节）。

#### Scenario: 登录表单不校验密码长度

- **WHEN** 在登录页输入任意长度密码
- **THEN** 前端**不**因长度阻止提交
- **AND** 错误密码是正常业务分支（返回 `401`），不是参数校验错误

#### Scenario: 重置密码表单二次确认

- **WHEN** 在重置页输入新密码与确认密码
- **THEN** 两者不一致时阻止提交并在确认字段下方提示

---

### Requirement: 错误响应与前端分支处理

所有错误响应 SHALL 使用统一信封 `{"error":{"code":...,"message":...,"details":...}}`，前端 SHALL 基于 `error.code` 分支。

#### Scenario: 统一错误信封可解析

- **WHEN** 任意 API 返回 4xx
- **THEN** 响应体为合法 JSON 且含 `error.code` 字符串字段
- **AND** 前端以 `error.code` 作为分支依据，而非依赖 `message` 文案

完整错误码 → 前端动作映射：

| `error.code` | HTTP | 前端动作 |
|---|---|---|
| `VALIDATION_FAILED` | 400 | 逐字段高亮（用 `error.details`） |
| `INVALID_VERIFICATION_CODE` | 400 | 验证页失败态 + 重发入口 |
| `INVALID_RESET_CODE` | 400 | 重置页失败态 + 重新申请入口 |
| `INVALID_CREDENTIALS` | 401 | 「邮箱或密码错误」 |
| `ACCOUNT_DELETED` | 401 | 「账号已注销」 |
| `UNAUTHENTICATED` | 401 | 清令牌 → 跳登录 |
| `TOKEN_INVALIDATED` | 401 | 清令牌 → 跳登录「请重新登录」 |
| `EMAIL_NOT_VERIFIED` | 403 | 「请先验证邮箱」+ 重发按钮 |
| `ACCOUNT_LOCKED` | 423 | 「已锁定」+ 倒计时 |
| `EMAIL_ALREADY_REGISTERED` | 409 | 邮箱字段提示 + 引导登录 |
| `RATE_LIMITED` | 429 | 「操作过于频繁」 |
| `INTERNAL_ERROR` | 500 | 通用错误文案 |

#### Scenario: 网络异常与后端不可达

- **WHEN** 请求因网络中断或后端无响应而失败（无 HTTP 响应）
- **THEN** 前端展示通用「网络异常，请稍后重试」
- **AND** **不**将此类失败误判为「邮箱或密码错误」

#### Scenario: 未预期错误不泄露实现细节

- **WHEN** 后端返回 `500 INTERNAL_ERROR`
- **THEN** 前端展示通用错误文案，不呈现堆栈或内部信息

---

### Requirement: 跨域与 BFF 边界

后端 SHALL 配置 CORS 放行前端来源，否则浏览器将直接拦截所有跨域请求。

> **缺口**：后端当前**零 CORS 配置**（全量搜索 `cors|CrossOrigin|allowedOrigins` 无命中）。前端（默认 `localhost:3000`）与后端（`localhost:8080`）不同源，此为前提性阻塞项。

#### Scenario: 后端放行前端开发来源

- **WHEN** 前端从 `http://localhost:3000` 发起请求
- **THEN** 后端响应含 `Access-Control-Allow-Origin` 且放行该来源
- **AND** 放行方法至少包含 `GET` / `POST` / `DELETE` / `OPTIONS`
- **AND** 放行请求头至少包含 `Authorization` 与 `Content-Type`

#### Scenario: 预检请求被正确处理

- **WHEN** 浏览器发起 `OPTIONS` 预检
- **THEN** 后端返回 `200` 且携带相应 CORS 响应头
- **AND** 不要求凭证（令牌经 `Authorization` 头传递，不使用 Cookie）

#### Scenario: 允许的来源可配置

- **WHEN** 部署到不同环境
- **THEN** 允许来源列表由配置项提供（如 `app.cors.allowed-origins`），**不**硬编码为 `*`

#### Scenario: BFF 层职责边界

- **WHEN** 前端调用后端认证 API
- **THEN** 调用封装于 `lib/backend.ts`（或等价认证客户端模块）
- **AND** 该模块仅负责拼接请求、传递令牌、解析统一错误信封
- **AND** **不**在前端实现状态判断、密码校验等业务逻辑（业务逻辑一律在后端）

---

### Requirement: 路由保护

需登录的页面 SHALL 在客户端校验登录态，未登录时跳转登录页。

> 令牌存于 localStorage，Next.js middleware（Edge Runtime）无法读取，故路由保护只能在客户端组件内实现。

#### Scenario: 未登录访问受保护页面

- **GIVEN** 本地无 access token
- **WHEN** 访问需登录的页面
- **THEN** 重定向至 `/login` 并携带 `redirect` 参数以便登录后回跳

#### Scenario: 已登录访问登录或注册页

- **GIVEN** 本地有有效 access token
- **WHEN** 访问 `/login`、`/register`、`/forgot-password`
- **THEN** 重定向至首页

---

### Requirement: 凭证类字段禁止出网（安全边界扩展）

`passwordResetCode` 与 `passwordChangedAt` SHALL 与既有 `passwordHash` / `salt` / `verificationCode` 一样受安全边界约束，禁止出现在任何 HTTP 响应中。

#### Scenario: 重置相关响应不含重置码

- **WHEN** `POST /api/auth/forgot-password` 或 `reset-password` 返回
- **THEN** 响应体**不**包含 `passwordResetCode` / `password_reset_code`、`passwordChangedAt`、`passwordHash` / `password_hash`、`salt`、`verificationCode` / `verification_code`

#### Scenario: 白名单护栏覆盖新字段

- **GIVEN** `User` 实体新增 `passwordResetCode` 与 `passwordChangedAt` 字段
- **WHEN** 运行 `UserResponse` 白名单序列化测试
- **THEN** 测试仍通过（新字段默认不可见，未加入白名单即不会出网）

> 白名单策略的价值在此体现：新增敏感字段**无需改动护栏**即自动受保护。

