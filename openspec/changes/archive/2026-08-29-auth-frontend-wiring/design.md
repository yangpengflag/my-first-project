# 技术设计：Auth 前端↔后端联通（接线与验证）

## 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│  前端 (Next.js App Router)                                        │
│                                                                    │
│  app/layout.tsx (Server)                                          │
│     └─ <AuthSessionProvider>  ← 客户端 Context，挂载于根            │
│           │  加载即：localStorage 有 token ? me() : 置未登录        │
│           ├─ <NavBar/>            读取 useAuthSession()             │
│           │     ├─ 已登录 → 昵称 + [登出]                           │
│           │     └─ 未登录 → [登录] [注册]                           │
│           └─ {children}                                            │
│                                                                    │
│  app/(auth)/* (login/register/forgot)  ← RedirectIfAuthenticated   │
│  app/auth/*  (verify/reset-password)                               │
│  app/account  (Client)             ← AuthGuard + useAuthSession    │
│       └─ 展示「欢迎，{displayName}」+ [登出]                        │
│                                                                    │
│  lib/auth/* (0005 已实现)                                          │
│   ├─ api.ts      register/login/verify/.../me/logout              │
│   ├─ client.ts   拼装 / Bearer / 401 静默续期重放 / 错误信封解析    │
│   └─ tokens.ts   localStorage access+refresh                       │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP / JSON（跨域，CORS 已放行 :3000）
┌───────────────────────────────▼────────────────────────────────────┐
│  后端 (:8080 /api/auth/*) — auth-module 已实现                     │
│   CORS → RateLimit → JwtAuthFilter → UserStatusFilter → Controller  │
│   LoggingMailSender.getSentMails()  ← 集成测试取验证/重置码用        │
└────────────────────────────────────────────────────────────────────┘
```

## 技术决策

| 决策项 | 选择 | 理由 | 替代方案与代价 |
|---|---|---|---|
| 会话引导载体 | 根布局 `AuthSessionProvider`（客户端 Context） | SSR 读不到 localStorage，须在客户端 resolve；Context 让任意组件（尤其 NavBar）读取会话 | middleware 读不到 localStorage，无法下沉 |
| 守卫校验依据 | `me()` 实时回查，而非仅 token 存在 | token 存在 ≠ 有效（过期 / 改密失效 / 锁定 / 注销）；`me()` 返回 200/401/403/423 直接映射 UI 动作 | 仅查 token 存在会放过失效会话，且无法反映锁定/注销 |
| 受保护种子页 | 最小 `/account` | 守卫与会话引导需一个真实挂载点来验证整条链路；同时是后续个人中心的自然种子 | 仅为测试建空页则脱离产品价值 |
| 登出实现 | `logout()` + `tokenStore.clear()` + 跳登录 | 后端 JWT 无状态，登出即丢弃本地令牌；与 client 的 `endSession` 语义一致 | 调 `/logout` 不清除本地则仍"看似登录" |
| 端到端验证主证据 | 后端 `@SpringBootTest` 集成测试 | 借 `getSentMails()` 取码，走真实 HTTP 全链路，绕开邮件不投递与浏览器不确定性，最稳定 | 纯前端 e2e 无法读取后端内存中的验证码，验证链路断裂 |
| 前端 e2e 定位 | UI 状态覆盖（不强行打通 verify） | 验证/重置码无法在浏览器侧获取；UI 分支已由单测 + 后端集成测试覆盖 | 给 e2e 开后门取码会污染生产代码 |
| 开发取码 | `auth.mail.log-verification-code=true` | 本地调试时日志打印完整链接，手动浏览器验联通；默认关闭防泄露 | 默认打印则日志泄露一次性凭证 |

## 会话引导时序

```
应用加载（根布局挂载 AuthSessionProvider）
      │
      ▼
localStorage 有 access token?
   │ 否 → status = 'unauthenticated'（导航栏显示 登录/注册）
   │ 是
   ▼
status = 'loading'；调用 GET /me
   ├─ 200            → status='authenticated'，填充 user（导航栏显示昵称+登出）
   ├─ 401 系列       → 触发 client 静默续期（refresh）；成功则重放 /me
   │       └─ 续期失败 → 清 token，status='unauthenticated'
   ├─ 403 EMAIL_NOT_VERIFIED → 清 token，提示先验证
   ├─ 423 ACCOUNT_LOCKED    → 清 token，提示锁定
   └─ 401 ACCOUNT_DELETED / TOKEN_INVALIDATED → 清 token，提示已注销/重登
```

> 为避免首屏闪烁：初始渲染以 `status==='loading'` 为中性态（导航栏不展示任一分支或展示骨架），待 `me()` 返回再定稿。

## 路由守卫契约

| 守卫 | 挂载位置 | 行为 |
|---|---|---|
| `AuthGuard` | `app/account`（及未来受保护页） | `status==='unauthenticated'` → `router.replace('/login?redirect='+pathname)`；`loading` → 渲染 null/skeleton；`authenticated` → 渲染 children |
| `RedirectIfAuthenticated` | `app/(auth)/login`、`/register`、`/forgot-password` | `status==='authenticated'` → `router.replace('/')` |

> 取代 0005 中 `AuthGuard`「仅查 token 存在」的朴素实现，改为消费 `useAuthSession()` 的 `me()` 结果。

## 端到端验证策略（G1）

```
① 后端集成测试（自动化主证据）
   @SpringBootTest + WebTestClient
     register (201)
       → 从 LoggingMailSender.getSentMails() 取 verificationCode
     verify?code=... (200)
     login (200 + tokens)
     me (200, 返回用户信息)
     logout (204)
   全程真实经过 CORS→RateLimit→JwtAuthFilter→UserStatusFilter→Controller

② 前端 e2e（UI 状态）
   npm run dev (前端 :3000) + mvn spring-boot:run (后端 :8080)
   npx playwright test tests/e2e/auth-flow.spec.ts
   覆盖：注册/登录/忘记密码/重置/验证页 的状态分支（verify 完整链路由①保证）

③ 开发 runbook（手动验联通）
   后端开启 auth.mail.log-verification-code=true → 日志打印完整前端链接
   浏览器走 register → 点日志链接 verify → login → 见 /account 欢迎语 → 登出
```

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 会话引导导致首屏闪烁 | 用户体验 | `loading` 中性态 + 骨架，避免未登录/已登录态跳变 |
| `me()` 在加载期失败（网络/令牌无效） | 误判为未登录 | 区分 `NetworkError`（保留 loading/重试）与业务 401（清 token）；client 已含该区分 |
| 守卫改为 `me()` 后首屏延迟 | 受保护页稍慢 | `loading` 渲染骨架，且 `/account` 仅在访问时触发 |
| 后端集成测试依赖 `LoggingMailSender` 内存态 | 测试脆弱 | 该组件本就为测试暴露 `getSentMails()`，契约稳定；测试内清空保证隔离 |
| 开发取码标志误开生产 | 日志泄露一次性凭证 | runbook 明确标注"仅本地调试"，默认 false |
| 令牌存 localStorage 被 XSS 窃取 | 冒充用户 | 续用 0005 评估结论：MVP 接受，演进路径为 BFF+httpOnly Cookie |
