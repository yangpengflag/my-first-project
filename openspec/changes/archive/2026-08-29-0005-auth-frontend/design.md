# 技术设计：Auth 前端与 API 契约

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│  前端 (Next.js 14.2.35 App Router / React 18.3.1)             │
│                                                                │
│  app/(auth)/                                                   │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐                │
│  │/register │ │ /login   │ │/forgot-password│                │
│  └────┬─────┘ └────┬─────┘ └───────┬────────┘                │
│       │            │                │                          │
│  app/auth/                                                     │
│  ┌────────────┐ ┌──────────────────┐                          │
│  │ /verify    │ │ /reset-password  │                          │
│  └─────┬──────┘ └────────┬─────────┘                          │
│        │                 │                                     │
│        └────────┬────────┘                                     │
│                 ▼                                              │
│  ┌──────────────────────────────────┐                         │
│  │  react-hook-form + zod (校验)     │                         │
│  └───────────────┬──────────────────┘                         │
│                  ▼                                             │
│  ┌──────────────────────────────────┐   ┌──────────────────┐ │
│  │  lib/backend.ts (认证客户端)      │──▶│ localStorage     │ │
│  │  · 拼装请求                       │   │ access/refresh   │ │
│  │  · 注入 Bearer                    │   └──────────────────┘ │
│  │  · 静默续期 + 重放                │                         │
│  │  · 解析统一错误信封                │                         │
│  └───────────────┬──────────────────┘                         │
└──────────────────┼─────────────────────────────────────────────┘
                   │ HTTP / JSON（跨域，需 CORS）
┌──────────────────▼─────────────────────────────────────────────┐
│  后端 (Spring Boot 3.5.16)  — auth-module 已实现                 │
│                                                                  │
│  CORS ─▶ RateLimitFilter ─▶ JwtAuthFilter ─▶ UserStatusFilter    │
│                                                    │             │
│                                        ┌───────────▼──────────┐ │
│                                        │    AuthController    │ │
│                                        └───────────┬──────────┘ │
│                                                    ▼            │
│                                        ┌────────────────────┐  │
│                                        │    AuthService     │  │
│                                        └─────────┬──────────┘  │
│                            ┌─────────────────────┼──────────┐  │
│                            ▼                     ▼          ▼  │
│                    ┌───────────────┐  ┌────────────┐ ┌───────┐│
│                    │ UserRepository│  │PasswordHasher│ │Mailer││
│                    └───────────────┘  └────────────┘ └───────┘│
└────────────────────────────────────────────────────────────────┘
```

## 技术决策

| 决策项 | 选择 | 理由 | 替代方案与代价 |
|---|---|---|---|
| **Token 存储** | `localStorage` + Bearer | 后端为 Bearer 设计，前端 JS 必须能取到令牌 | httpOnly Cookie 更安全，但需后端改为从 Cookie 读令牌 |
| **路由保护** | 客户端组件守卫 | middleware（Edge Runtime）读不到 localStorage | 改用 Cookie 后可下沉到 middleware |
| **表单方案** | `react-hook-form` + `zod` | 与 shadcn `form` 组件天然集成；schema 可复用为单一约束来源 | 原生 state 零依赖但校验逻辑重复且易漂移 |
| **令牌校验端点** | 复用 `GET /me` | 已完成校验且顺带返回用户信息（刷新时本就需要） | `introspect` 服务于第三方接入方，本项目无此场景 |
| **邮箱实时查重** | 不提供 | 与「精确状态码 + 限流」的防枚举路线冲突 | 提供则攻击者可无限枚举注册邮箱 |
| **重置码有效期** | 1 小时 | 重置码敏感度高于邮箱验证码（24 小时） | 更长便利但风险更高 |
| **重置后激活邮箱** | 是 | 能收到重置邮件即证明邮箱可达；否则用户重置后仍被 403 挡住 | 不激活则状态机更纯但体验缺陷 |
| **密码变更通知** | 发送 | 非本人重置时让用户及时察觉（OWASP 推荐）；邮件接口已存在，仅加方法与模板 | 不发则少一封邮件，但失去异常告警渠道 |
| **旧令牌失效** | `iat` vs `passwordChangedAt` 比对 | 无状态 JWT 下实现「改密即登出」的标准做法 | Redis 黑名单需引入中间件 |
| **CORS 来源** | 配置项，非 `*` | 通配符与凭证策略冲突且过宽 | 硬编码单来源则多环境部署不便 |

## 密码重置流程

```
① 登录页点「忘记密码？」
        │
        ▼
② /forgot-password 输入邮箱
        │
        ▼
   POST /api/auth/forgot-password { email }
        │
        ├──▶ 恒定 202（不透露邮箱是否存在）
        │
        └──▶ 仅当邮箱存在且非 DELETED 时：
             生成一次性 code（1h）→ 发邮件
                    │
                    ▼
③ 邮件链接 → https://<frontend>/auth/reset-password?code=xxx
        │
        ▼
④ 前端页面：输入新密码 + 确认
        │
        ▼
   POST /api/auth/reset-password { code, newPassword }
        │
        ├──▶ 400 INVALID_RESET_CODE（无效/过期/已用，三态同码）
        ├──▶ 400 VALIDATION_FAILED（密码不在 8–72）
        │
        └──▶ 200 成功
              ├─ 更新 passwordHash
              ├─ 重置码置空（用后即焚）
              ├─ passwordChangedAt = now   ──▶ 旧令牌全部失效
              ├─ failedAttempts 归零（解除锁定）
              └─ 若 EMAIL_UNVERIFIED → 一并置为 ACTIVE
        │
        ▼
⑤ 展示成功态 → 跳转 /login
```

## 令牌失效机制

无状态 JWT 的一大痛点是「改密后旧令牌仍有效」。解法是在令牌与用户之间建立版本锚点：

```
签发时：JWT { sub: userId, iat: T0, exp: T0+15min }
                                    │
改密后：User.passwordChangedAt = T1 (T1 > T0)
                                    │
校验时：if (token.iat < user.passwordChangedAt)
            → 401 TOKEN_INVALIDATED
        else
            → 放行
```

| 校验位置 | 作用 |
|---|---|
| `UserStatusFilter` | 所有需鉴权请求：access token 签发早于改密即拒绝 |
| `AuthService.refresh` | refresh token 同样校验，阻止用旧 refresh 换新 access |

> 代价：每个需鉴权请求多一次用户查询（与本已存在的状态回查合并，无额外开销）。

## 页面结构与路由

| 路由 | 类型 | 职责 |
|---|---|---|
| `app/(auth)/layout.tsx` | Server Component | 认证页统一布局（居中卡片、品牌头） |
| `app/(auth)/login/page.tsx` | Server | 外壳，渲染 Client 表单 |
| `app/(auth)/register/page.tsx` | Server | 外壳，渲染 Client 表单 |
| `app/(auth)/forgot-password/page.tsx` | Server | 外壳，渲染 Client 表单 |
| `app/auth/verify/page.tsx` | Client | 读取 `?code=`，挂载即调验证接口 |
| `app/auth/reset-password/page.tsx` | Client | 读取 `?code=`，展示新密码表单 |

> 依据 `project.md`：Server Component 不可直接 render，需抽为 Client Component 后测试。故表单与依赖 `useSearchParams` 的页面均为 Client Component，页面外壳保持 Server Component。

## 表单校验分层

```ts
// 单一约束来源，与后端逐字段对齐
const emailField    = z.string().min(1).email().max(254);
const passwordField = z.string().min(8).max(72);   // 72 = BCrypt 字节截断上限

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().min(1).max(64),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),   // 登录不校验长度：错误密码是业务分支而非校验错误
});

export const resetSchema = z.object({
  newPassword: passwordField,
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  path: ['confirmPassword'],
  message: '两次输入的密码不一致',
});
```

前端校验属**即时反馈**，后端保持**权威校验**——两者约束一致但职责不同，前端绕过校验时后端仍能拦住。

## 前端依赖与组件

| 类型 | 项 | 获取方式 |
|---|---|---|
| 运行时依赖 | `react-hook-form`、`zod`、`@hookform/resolvers` | `npm install` |
| shadcn 组件 | `label`、`card`、`form`、`alert` | `npx shadcn@latest add label card form alert` |

> 当前 `components/ui/` 仅 `button` / `input` / `skeleton`，上述 4 个为新增。
> shadcn 的 `form` 组件本身即基于 `react-hook-form`，与选定的表单方案天然集成。

## 会话维持与静默续期

```
应用启动 / 页面刷新
      │
      ▼
localStorage 有 access token?
   │ 否 → 未登录态
   │ 是
   ▼
GET /api/auth/me
   │
   ├─ 200            → 已登录，写入用户信息
   ├─ 401 UNAUTHENTICATED / TOKEN_INVALIDATED → 尝试 refresh
   │                        ├─ 成功 → 更新 token，重放 /me
   │                        └─ 失败 → 清 token，跳登录
   ├─ 401 ACCOUNT_DELETED   → 清 token，提示已注销
   ├─ 423 ACCOUNT_LOCKED    → 清 token，提示锁定
   └─ 403 EMAIL_NOT_VERIFIED→ 清 token，提示先验证
```

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| Token 存 localStorage 被 XSS 窃取 | 攻击者可冒充用户 | React 默认转义、禁用 `dangerouslySetInnerHTML`；MVP 接受此风险，演进路径为 BFF 代理 + httpOnly Cookie |
| middleware 无法读 localStorage | 路由保护只能在客户端做，首屏可能闪现未登录态 | 客户端守卫 + 骨架屏/skeleton 占位 |
| 忘记密码端点被滥用于邮件轰炸 | 用户收到大量邮件 | `forgot-password` 恒定 `202` + IP 5 次/小时、(IP+email) 3 次/24 小时限流 |
| 重置码被爆破 | 攻击者猜码接管账号 | UUID v4 码空间足够 + `reset-password` 端点限流 10 次/小时 + 1 小时有效期 |
| 前后端字段约束漂移 | 前端放行、后端拒绝（或反之） | zod schema 与后端注解逐字段对齐，并由测试双向覆盖 |
| CORS 配置过宽 | 任意站点可调用 API | 来源走配置项，禁止 `*`；仅放行必要方法与请求头 |
| 超长密码被 BCrypt 静默截断 | 用户误以为密码很强 | 前后端均约束 8–72；72 上限源于 BCrypt 仅处理前 72 字节 |
| 邮件链接指向后端 API | 用户看到裸 JSON，后端地址暴露 | 链接统一指向前端页面，后端配置前端 base URL |
