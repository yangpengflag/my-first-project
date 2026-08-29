## Why

`auth-frontend`（0005，已于 2026-08-29 归档）交付了注册 / 登录 / 邮箱验证 / 密码重置页面、`lib/auth/*` 调用层与路由守卫组件，且契约核对显示前后端 `ErrorCode` 12 项、错误信封形状、邮件链接指向**完全对齐**，CORS 也已放行 `http://localhost:3000`。

但"联通"只是**代码就位，从未闭环**，存在 5 处留白：

1. **从未真机跑通**：两端代码就绪，但 `tests/e2e/auth-flow.spec.ts` 要求后端常驻 `:8080`，目前无人起服务把 register→verify→login→me→logout 真正跑绿；且 e2e 因邮件不投递而**主动跳过验证这一步**，导致"登录成功拿令牌"这条主干从未被端到端证明。
2. **`AuthGuard` 是孤儿组件**：其仅检查「localStorage 有没有 token」，未用 `me()` 校验有效性；且全仓搜索显示它**未被任何路由挂载**（仅存在于自身测试）。
3. **无会话引导**：刷新页面后没有 `me()` 恢复 / 校验会话，导航栏无法反映登录态，令牌过期/失效也无从感知。
4. **无登出入口**：`authApi.logout()` 已实现，但导航栏没有任何按钮调用它。
5. **开发取码未文档化**：验证 / 重置码默认不打印日志，手动验联通时拿不到 `?code=`。

结果是：页面"能发请求"，但应用**不像一个已认证的产品的形态**。本 change 负责把这个环闭合。

## What Changes

### 前端变更（主体）

- **会话引导（Session Bootstrap）**：新增 `AuthSessionProvider`（React Context）+ `useAuthSession()`，在应用加载时若 localStorage 有 token 则调 `me()` 校验并填充用户信息；对外暴露 `{ user, status, logout }`。
- **守卫落地 + 改为 `me()` 校验**：`AuthGuard` 改为基于 `useAuthSession()` 的状态（`unauthenticated`→跳登录并带 `redirect`；`loading`→渲染骨架/空），而非仅看 token 是否存在；挂载到一个新的最小受保护路由 `/account`（同时作为个人中心的种子页，证明整条链路）。
- **已登录重定向**：`RedirectIfAuthenticated` 挂载到 `(auth)` 路由组，已登录用户访问 `/login` `/register` `/forgot-password` 直接回首页。
- **导航栏接入会话**：根布局消费 `useAuthSession()`——已登录显示昵称 + 登出按钮，未登录显示登录 / 注册入口。
- **登出接线**：导航栏按钮 → `authApi.logout()` → 清除令牌 → 跳登录。
- **端到端验证（核心）**：
  - 后端新增 `@SpringBootTest` 集成测试，借 `LoggingMailSender.getSentMails()` 取出验证码，走通 register→verify→login→me→logout 真实 HTTP 全链路（无需浏览器、无需真实邮件投递）。
  - 起后端 + 前端，跑 `tests/e2e/auth-flow.spec.ts` 确认 UI 状态正确。
  - 输出开发期 runbook（启服命令 + 开启 `auth.mail.log-verification-code=true` 取码）。

### 后端变更（配合项）

- **无代码改动**。契约已对齐，仅补充开发期取码说明（见下 G5 / README）。
- 验证用到的 `LoggingMailSender.getSentMails()` 已存在并被测试使用，无需新增端点或后门。

### 明确不包含（Out of Scope）

- ❌ 个人中心完整 UI（头像 / 昵称 / 简介编辑、他人公开页）——`/account` 仅作受保护种子页
- ❌ 消息通知 / 站内信
- ❌ BFF 代理 + httpOnly Cookie 改造（Token 仍存 localStorage）
- ❌ 真实 SMTP 投递（沿用 `LoggingMailSender`）
- ❌ 任何新的认证端点或错误码

### 规格变更

- 新增 `openspec/specs/auth-frontend-wiring/spec.md`

## Capabilities

### New Capabilities

- `auth-frontend-wiring`：定义 WanderChina 前端的会话引导（加载即 `me()` 恢复 / 校验）、路由守卫契约（`me()` 驱动的鉴权）、登出契约、以及"前端↔后端联通"的端到端验证策略与开发期取码规范。

### Modified Capabilities

- （无——沿用 `auth-frontend` 与 `auth-module` 既有契约，不修改其 spec）

## Impact

- **前端**：新增 `AuthSessionProvider` / `useAuthSession()`、根布局导航栏会话接入、最小受保护页 `/account`；新增前端单测 + 后端集成测试。无新增运行时依赖（所需 `react-hook-form` / `zod` / shadcn 组件已在 0005 引入）。
- **后端**：无代码改动；仅文档补充。
- **安全**：Provider 仍从 localStorage 读令牌（XSS 面已在 0005 评估并接受）；登出严格清除本地令牌；守卫以 `me()` 实时回查，令牌失效 / 账号锁定 / 注销即时在 UI 生效。
- **跨模块**：本 change 是后续个人中心 / 通知 / 站内信的会话基座——这些模块将直接复用 `useAuthSession()`。
- **约束合规**：业务逻辑（状态判断、密码校验）仍在后端；前端仅做传输、解析、展示与路由拦截，符合 `project.md`「业务逻辑一律在后端」。

## Open Questions

- [ ] `/account` 种子页做到什么程度？——**暂定**：仅展示「欢迎，{displayName}」+ 登出，作为守卫与会话引导的验证载体，不做资料编辑
- [ ] 后端集成测试是否纳入本 change 的"验证"阶段？——**暂定**：纳入，作为联通最可靠的自动化证据（绕开邮件投递）
- [ ] `auth.mail.log-verification-code` 是否需要在文档中标注"仅本地调试、禁止生产开启"？——**暂定**：是，明确红线
