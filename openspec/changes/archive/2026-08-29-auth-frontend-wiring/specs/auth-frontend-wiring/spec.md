# Capability: auth-frontend-wiring

> 本 capability 负责把 `auth-frontend`（0005）交付的认证页面与 `auth-module` 后端**真正联通并闭环**：
> 会话引导、路由守卫（`me()` 驱动）、登出、以及端到端验证策略。
> 复用 `auth-frontend` 与 `auth-module` 既有契约，不修改其 spec。

## 概述

前端在应用加载时即恢复并校验会话，任意组件（尤其导航栏）可读取登录态；受保护路由以 `me()` 实时结果鉴权；登出严格清除本地令牌；"联通"由后端集成测试 + 前端 e2e 共同证明。

具体落地为 `AuthSessionProvider` / `useAuthSession()`（根布局挂载）、`/account` 受保护种子页、`NavBar` 会话接入、`LogoutButton` 登出按钮；后端 `AuthFlowIntegrationTest` 以真实 HTTP 全链路证明 register→verify→login→me→logout 联通。

## 需求（Requirements）

### Requirement: 会话引导（Session Bootstrap）
应用加载时，`AuthSessionProvider` 若存在本地 access token 则调用 `GET /me` 校验并填充用户信息，对外暴露 `{ user, status, logout }`。

- `WHEN` localStorage 无 token，`status` 应为 `unauthenticated`
- `WHEN` 有 token 且 `GET /me` 返回 `200`，`status` 应为 `authenticated` 且 `user` 为返回的用户信息
- `WHEN` `GET /me` 返回 `401 UNAUTHENTICATED` / `TOKEN_INVALIDATED` / `ACCOUNT_DELETED` / `ACCOUNT_LOCKED` / `EMAIL_NOT_VERIFIED`，应清除本地令牌并置 `unauthenticated`
- `WHEN` `GET /me` 抛 `NetworkError`（请求未达后端），不应清除令牌（保留可重试态）
- `WHEN` 令牌续期后 `me()` 成功，应沿用续期后的会话

### Requirement: 路由守卫（`me()` 驱动）
`AuthGuard` 基于 `useAuthSession()` 状态拦截：

- `WHEN` `status==='unauthenticated'`，重定向至 `/login?redirect=<当前路径>`
- `WHEN` `status==='loading'`，渲染骨架 / 空（不闪现受保护内容）
- `WHEN` `status==='authenticated'`，渲染 children

`RedirectIfAuthenticated` 挂载于 `(auth)` 路由组（`/login` `/register` `/forgot-password`）：

- `WHEN` `status==='authenticated'`，重定向至 `/`

### Requirement: 登出契约
登出须完整闭环：

- `WHEN` 用户登出，应调用 `authApi.logout()`，清除 localStorage 中的 access 与 refresh 令牌，并将 `status` 置为 `unauthenticated`，跳转 `/login`

### Requirement: 端到端验证策略
"前端↔后端联通"须被自动化证明：

- `WHEN` 运行后端集成测试，应走通 register→verify→login→me→logout 真实 HTTP 全链路（验证/重置码自 `LoggingMailSender.getSentMails()` 取，无需真实邮件投递）
- `WHEN` 运行前端 Playwright e2e，认证相关页面状态分支应全绿
- `WHEN` 本地手动验联通，应通过 `auth.mail.log-verification-code=true` 从日志取得含 `?code=` 的前端链接完成验证（该标志仅限本地调试，禁止生产开启）

## 验收场景（Scenarios）

### Scenario: 刷新后保持登录
- **Given** 用户已登录（localStorage 有有效 token）
- **When** 刷新页面
- **Then** `AuthSessionProvider` 调 `me()` 返回 200，导航栏立即显示昵称与登出，不退回未登录态

### Scenario: 改密后旧令牌失效被感知
- **Given** 用户持旧令牌（签发于改密前）
- **When** 应用加载 / 访问受保护页触发 `me()`
- **Then** 后端返回 `401 TOKEN_INVALIDATED`，前端清除令牌并跳登录

### Scenario: 已登录访问登录页被弹回
- **Given** 用户已登录
- **When** 访问 `/login`
- **Then** 重定向至 `/`

### Scenario: 登出闭环
- **Given** 用户已登录
- **When** 点登出
- **Then** 调 `logout()`、清本地令牌、跳 `/login`、导航栏回到未登录态

### Scenario: 联通自动化证明
- **Given** 后端常驻且测试可取其内存邮件记录
- **When** 运行后端集成测试
- **Then** register→verify→login→me→logout 全绿，证明前后端契约真机跑通
