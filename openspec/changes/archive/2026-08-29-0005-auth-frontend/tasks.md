# Tasks: Auth 前端与 API 契约

> 全部任务遵循 TDD：每个 GREEN 步骤前必须先有对应的 RED 测试。
>
> **排序原则**：CORS 是前提性阻塞项（不解决前端发不出任何请求），故排在最前；
> 后端能力先于前端页面就绪，避免前端对着不存在的接口开发。
>
> **后端命令提示**：本机 `mvn` 不在 PATH 且默认走 JDK 8，须先固定环境：
> ```powershell
> $env:JAVA_HOME = "D:\Programs\java17"
> & "D:\Programs\maven\bin\mvn.cmd" test
> ```

---

## Phase 1: 后端 CORS（阻塞项，优先）

- [x] 1.1 **RED** `CorsIntegrationTest`：断言 `OPTIONS` 预检返回 `200` 且携带 `Access-Control-Allow-Origin` / `Allow-Methods` / `Allow-Headers`
- [x] 1.2 **RED** 断言实际 `POST /api/auth/login` 的响应含 `Access-Control-Allow-Origin`，且放行 `Authorization` 与 `Content-Type` 请求头
- [x] 1.3 **GREEN** `SecurityConfig` 启用 CORS，放行方法 `GET` / `POST` / `DELETE` / `OPTIONS`，不启用凭证（令牌经 `Authorization` 头传递）
- [x] 1.4 **GREEN** 新增配置项 `app.cors.allowed-origins`（默认含 `http://localhost:3000`），**禁止**硬编码 `*`
- [x] 1.5 **RED** 断言未在允许列表中的来源**不**被放行（防止图省事配成通配符）

---

## Phase 2: 后端——密码重置字段与安全边界

- [x] 2.1 **RED** `UserTest`：断言重置码可签发、可消费、过期失效、用后即焚
- [x] 2.2 **GREEN** `User` 实体新增 `passwordResetCode` / `passwordResetCodeExpiresAt` / `passwordChangedAt`，并补充行为方法（签发、消费、标记密码变更）
- [x] 2.3 **RED** `UserRepositoryTest`：断言可按重置码定位用户；已消费（置空）的码不命中
- [x] 2.4 **GREEN** `UserRepository` 新增 `findByPasswordResetCode`
- [x] 2.5 **RED** `UserResponseSerializationTest` 补充：断言序列化输出**不**含 `passwordResetCode` / `password_reset_code` / `passwordChangedAt`
- [x] 2.6 **验证** 既有白名单护栏仍通过（新敏感字段默认不可见，无需改动护栏即受保护）

---

## Phase 3: 后端——密码重置端点

- [x] 3.1 **RED** `forgot-password` 恒定成功：已注册未注销邮箱 → `202` 且投递；不存在邮箱 → 仍 `202` 且**不**投递；已注销 → `202` 且**不**投递
- [x] 3.2 **GREEN** 实现 `AuthService.requestPasswordReset`
- [x] 3.3 **RED** `reset-password` 有效码 → `200`；无效 / 过期 / 已使用的码统一 `400 INVALID_RESET_CODE`（三态同码，不泄露细节）
- [x] 3.4 **GREEN** 实现 `AuthService.resetPassword`
- [x] 3.5 **RED** 断言重置成功后：`passwordChangedAt` 更新、`failedAttempts` 归零、重置码置空
- [x] 3.6 **RED** 断言 `EMAIL_UNVERIFIED` 用户重置成功后状态转为 `ACTIVE`
- [x] 3.7 **GREEN** 实现上述状态副作用
- [x] 3.8 **RED** 断言新密码受 8–72 约束，越界返回 `400 VALIDATION_FAILED`
- [x] 3.9 **RED** 断言重置成功会投递「密码已变更」通知，且通知内容不含新密码或重置码
- [x] 3.10 **RED** 断言通知投递失败**不**回滚重置结果（重置已生效，仅记录日志）
- [x] 3.11 **GREEN** `MailSender` 新增密码变更通知方法，`LoggingMailSender` 实现

---

## Phase 4: 后端——密码变更导致令牌失效

- [x] 4.1 **RED** `UserStatusFilterHttpTest`：断言密码变更**之前**签发的令牌调用 `/api/auth/me` 返回 `401 TOKEN_INVALIDATED`
- [x] 4.2 **GREEN** `UserStatusFilter` 比对令牌 `iat` 与用户 `passwordChangedAt`
- [x] 4.3 **RED** 断言变更**之后**签发的令牌仍可正常访问
- [x] 4.4 **RED** `AuthService.refresh` 同样校验：旧 refresh token 无法换新 access token
- [x] 4.5 **GREEN** `AuthService.refresh` 补充失效校验

---

## Phase 5: 后端——补齐项

- [x] 5.1 **RED** 断言长度 > 72 的密码在注册时被拒（`400 VALIDATION_FAILED`）
- [x] 5.2 **GREEN** `RegisterRequest` 与重置请求 DTO 的密码字段补 `@Size(min = 8, max = 72)`
- [x] 5.3 **RED** 断言验证邮件与重置邮件中的链接指向**前端**地址（含 `app.frontend-base-url`）
- [x] 5.4 **GREEN** 新增 `app.frontend-base-url` 配置，`MailSender` 据此生成 `/auth/verify?code=` 与 `/auth/reset-password?code=` 完整链接
- [x] 5.5 **GREEN** `ErrorCode` 新增 `INVALID_RESET_CODE`（400）与 `TOKEN_INVALIDATED`（401）
- [x] 5.6 **RED** `forgot-password` 限流与 `resend-verification` 取齐：IP 10 次/1 小时、(IP+email) 3 次/24 小时超限 → `429`
- [x] 5.7 **RED** `reset-password` 限流：同一 IP 10 次/1 小时超限 → `429`（防重置码爆破）
- [x] 5.8 **GREEN** `RateLimitFilter` 纳入两个新端点
- [x] 5.9 **RED** 断言 `423 ACCOUNT_LOCKED` 响应含 `retryAfterSeconds`
- [x] 5.10 **GREEN** 错误信封支持该字段（可复用既有 `details` 通道）
- [x] 5.11 **验证** 后端全量 `mvn test` 绿灯（150 测试通过）

---

## Phase 6: 前端——依赖与 UI 组件

- [x] 6.1 安装运行时依赖：`react-hook-form`、`zod`、`@hookform/resolvers`
- [x] 6.2 通过 shadcn CLI 添加组件：`npx shadcn@latest add label card form alert`
- [x] 6.3 **验证** `npm run build` 与 `npm test` 均通过（确认新依赖与组件未破坏既有首页）

---

## Phase 7: 前端——认证客户端与 Token 管理

- [x] 7.1 **RED** 认证客户端测试：断言请求拼装、Bearer 令牌注入、统一错误信封解析
- [x] 7.2 **GREEN** 实现认证客户端（封装于 `lib/auth/client.ts`），**仅**负责传输与解析，不含业务逻辑
- [x] 7.3 **RED** Token 存储测试：`localStorage` 的存 / 取 / 清除，键名稳定
- [x] 7.4 **GREEN** 实现 Token 存储模块（`lib/auth/tokens.ts`）
- [x] 7.5 **RED** 静默续期测试：需鉴权请求遇 `401 UNAUTHENTICATED` 时触发 `refresh`，成功则更新令牌并**重放**原请求；失败则清除令牌
- [x] 7.6 **GREEN** 实现静默续期
- [x] 7.7 **RED** 断言 `TOKEN_INVALIDATED` / `ACCOUNT_DELETED` / `ACCOUNT_LOCKED` 均清除本地令牌并跳转登录
- [x] 7.8 **RED** 断言令牌**不**出现在 URL query string 或日志中

---

## Phase 8: 前端——页面与 zod 表单

- [x] 8.1 **RED** `auth.schemas.test.ts`：断言注册 / 登录 / 重置 schema 的约束（邮箱格式与 254 上限、密码 8–72、昵称 1–64、两次密码一致性）
- [x] 8.2 **GREEN** 实现 zod schemas（与后端约束逐字段对齐）
- [x] 8.3 **RED** 注册页测试：提交成功切换「请查收验证邮件」；`409` 在邮箱字段下方提示；请求中禁止重复提交
- [x] 8.4 **GREEN** 实现 `/register`
- [x] 8.5 **RED** 登录页测试：成功存储令牌并跳转；`403` 展示「请先验证邮箱」+ 重发按钮；`423` 展示倒计时；`401` 展示通用文案且不透露邮箱是否存在；提供「忘记密码？」入口
- [x] 8.6 **GREEN** 实现 `/login`
- [x] 8.7 **RED** 忘记密码页测试：提交后恒定展示成功态，**不**透露邮箱是否已注册
- [x] 8.8 **GREEN** 实现 `/forgot-password`
- [x] 8.9 **RED** 验证结果页测试：成功态 / 失败态 / 加载态三态正确切换，失败时提供重发入口
- [x] 8.10 **GREEN** 实现 `/auth/verify`
- [x] 8.11 **RED** 重置密码页测试：新密码与确认不一致时阻止提交；成功展示成功态并跳转登录
- [x] 8.12 **GREEN** 实现 `/auth/reset-password`
- [x] 8.13 **RED** 断言表单具备可访问性：每个输入框有关联 `<label>`，错误提示可被读屏获取

---

## Phase 9: 前端——路由保护与收尾

- [x] 9.1 **RED** 未登录访问受保护页面 → 跳转 `/login` 且携带 `redirect` 参数
- [x] 9.2 **GREEN** 实现客户端路由守卫
- [x] 9.3 **RED** 已登录访问 `/login` / `/register` / `/forgot-password` → 跳转首页
- [x] 9.4 **E2E** Playwright 覆盖主流程：注册 → 查收验证链接 → 验证 → 登录 → 访问受保护页
- [x] 9.5 **E2E** Playwright 覆盖重置流程：忘记密码 → 重置链接 → 设置新密码 → 用新密码登录
- [x] 9.6 **验证** `npm test`、`npm run build`、`npm run test:e2e` 全绿
- [x] 9.7 更新 `frontend/README.md`：记录新增路由、表单方案、Token 存储策略与已知权衡
- [x] 9.8 **安全复查**：确认前端不出现任何凭证类字段的持久化或日志输出

---

## 里程碑检查点

| 里程碑 | 完成标志 | 意义 |
|---|---|---|
| M1 | Phase 1 完成 | 跨域打通，前后端可联调 |
| M2 | Phase 2–5 完成 | 后端 API 契约全部就绪 |
| M3 | Phase 6–7 完成 | 前端具备调用与会话维持能力 |
| M4 | Phase 8–9 完成 | 页面可用，端到端流程跑通 |
