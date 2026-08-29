# Tasks: Auth 前端↔后端联通（接线与验证）

> 全部任务遵循 TDD：每个 GREEN 步骤前必须先有对应的 RED 测试。
>
> **排序原则**：先建会话基座（Provider/Hook），再落地守卫与导航接入，最后做端到端验证——验证放在最后是因为它需要前面所有接线就绪。
>
> **环境提示（沿用 0005）**：
> ```powershell
> # 后端测试/启动（本机 mvn 不在 PATH 且默认 JDK8）
> $env:JAVA_HOME = "D:\Programs\java17"
> & "D:\Programs\maven\bin\mvn.cmd" test
> # 后端常驻
> & "D:\Programs\maven\bin\mvn.cmd" spring-boot:run
> # 前端
> npm run dev        # :3000
> npx playwright test tests/e2e/auth-flow.spec.ts
> ```

---

## Phase 1: 会话引导基座（Provider + Hook）

- [x] 1.1 **RED** `auth-session.test.tsx`：无 token 时 `status==='unauthenticated'`；有 token 时挂载触发 `me()` 且返回 200 后 `status==='authenticated'` 且 `user` 正确
- [x] 1.2 **RED** 断言 `me()` 返回 `401 UNAUTHENTICATED`/`TOKEN_INVALIDATED`/`ACCOUNT_DELETED`/`ACCOUNT_LOCKED`/`EMAIL_NOT_VERIFIED` 时清除 token 并置 `unauthenticated`；`NetworkError` 时不清除（保留 loading/可重试）
- [x] 1.3 **GREEN** 实现 `AuthSessionProvider` + `useAuthSession()`（封装 `authApi.me()` 与 `tokenStore`，暴露 `user/status/logout`）
- [x] 1.4 **GREEN** 在根布局 `app/layout.tsx` 挂载 `<AuthSessionProvider>`
- [x] 1.5 **RED** 断言 Provider 不向 URL query / 日志泄露令牌

## Phase 2: 守卫落地与 `me()` 校验

- [x] 2.1 **RED** `auth-guard.test.tsx`：以 `useAuthSession()` 驱动——`unauthenticated`→跳 `/login?redirect=<path>`；`loading`→渲染 null；`authenticated`→渲染 children
- [x] 2.2 **GREEN** 改写 `AuthGuard` 消费 `useAuthSession()`（取代「仅查 token 存在」）
- [x] 2.3 **GREEN** 新增最小受保护页 `app/account/page.tsx`：Client 组件，用 `AuthGuard` 包裹，展示「欢迎，{displayName}」+ 登出按钮
- [x] 2.4 **RED** `redirect-if-authenticated.test.tsx`：已登录访问 `/login` `/register` `/forgot-password` → 跳首页
- [x] 2.5 **GREEN** 在 `(auth)` 路由组对应页面挂载 `RedirectIfAuthenticated`

## Phase 3: 导航栏接入会话

- [x] 3.1 **RED** `nav-bar.test.tsx`：`authenticated` 显示昵称 + 登出入口；`unauthenticated` 显示登录 / 注册入口
- [x] 3.2 **GREEN** 实现 `NavBar` 消费 `useAuthSession()`（置于根布局）
- [x] 3.3 **GREEN** 处理 Hydration：初始中性态，避免 SSR/CSR 不一致告警

## Phase 4: 登出接线

- [x] 4.1 **RED** 点击登出 → 调用 `authApi.logout()`、清除 localStorage 令牌、跳转 `/login`、会话态回到 `unauthenticated`
- [x] 4.2 **GREEN** 实现导航栏登出按钮与 `/account` 页登出按钮

## Phase 5: 端到端验证（核心，G1）

- [x] 5.1 **RED** 后端 `AuthFlowIntegrationTest`（`@SpringBootTest` + WebTestClient）：register→(从 `LoggingMailSender.getSentMails()` 取码)→verify→login→me→logout 全链路 200/201/204
- [x] 5.2 **GREEN** 实现该集成测试（无后端代码改动，仅测试）
- [x] 5.3 **验证** 起后端 + 前端，运行 `tests/e2e/auth-flow.spec.ts` 全绿
  - ✅ 实跑通过（Playwright 用 `D:\tools\chrome-win64\chrome.exe`）：**30 passed / 2 skipped（注册限流预期跳过）/ 0 failed**，用时 2.5m，覆盖 desktop + mobile 两项目
- [x] 5.4 **文档（G5）** 在 `frontend/README.md` 追加「本地联通 runbook」：启服命令、`auth.mail.log-verification-code=true` 取码说明（标注"仅本地、禁生产"）、手动走通路径

## Phase 6: 收尾验证

- [x] 6.1 **验证** 前端 `npm test` 全绿（Vitest 单测，10 文件 / 85 测试）
- [x] 6.2 **验证** 前端 `npm run build` 通过（含全量类型检查）
- [x] 6.3 **验证** 后端 `mvn test` 全绿（含 5.1 集成测试，151 测试）
- [x] 6.4 **验证** 前端 `npm run test:e2e` 全绿（需后端常驻）
  - ✅ 同 5.3：实跑 **30 passed / 2 skipped / 0 failed**，含 `auth-flow` 与 `homepage-hero` 全部用例
- [x] 6.5 更新 `openspec/specs/auth-frontend-wiring/spec.md` 终稿（与实现对齐）
- [x] 6.6 **安全复查**：确认前端不持久化/日志输出任何凭证类字段（令牌仅存 localStorage，不在 URL/日志泄露；`session.test.tsx` 1.5 断言佐证）

---

## 里程碑检查点

| 里程碑 | 完成标志 | 意义 |
|---|---|---|
| M1 | Phase 1 完成 | 应用加载即恢复/校验会话，会话态可被任意组件读取 |
| M2 | Phase 2–3 完成 | 守卫真实生效、`me()` 驱动鉴权、导航栏反映登录态 |
| M3 | Phase 4 完成 | 登出全链路闭环 |
| M4 | Phase 5–6 完成 | 前后端真机联通被自动化证明（集成测试 + e2e 全绿） |
