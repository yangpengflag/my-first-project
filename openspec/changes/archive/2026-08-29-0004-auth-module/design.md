# 技术设计：Auth 模块

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│  前端 (Next.js 14 App Router)                                 │
│  ⚠️ 本 change 不涉及，仅预留契约                                │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP / JSON（跨域：Vercel → 自托管）
┌────────────────────────▼─────────────────────────────────────┐
│  后端 (Spring Boot 3.5.16 / Java 17)                          │
│                                                                │
│  请求 → ① RateLimitFilter → ② JwtAuthFilter                   │
│              │                      │                          │
│              ▼                      ▼                          │
│      ┌───────────────┐     ┌────────────────────┐             │
│      │ RateLimiter   │     │  UserStatusFilter  │             │
│      │(内存滑动窗口)  │     │ 状态非 ACTIVE 即短路│             │
│      └───────────────┘     └─────────┬──────────┘             │
│        仅 /api/auth/**                 │                        │
│                                       ▼                        │
│                            ┌────────────────────┐             │
│                            │   AuthController   │             │
│                            └─────────┬──────────┘             │
│                                      ▼                         │
│                            ┌────────────────────┐             │
│                            │    AuthService     │             │
│                            └─────────┬──────────┘             │
│              ┌───────────────────────┼──────────────┐         │
│              ▼                       ▼              ▼         │
│   ┌──────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│   │  UserRepository  │  │ PasswordHasher │  │  TokenService │ │
│   │   (JPA + H2)     │  │  (BCrypt)      │  │    (JWT)     │ │
│   └──────────────────┘  └────────────────┘  └──────────────┘ │
│              │                                                 │
│              ▼                          ┌──────────────────┐  │
│      ┌──────────────┐                   │    MailSender    │  │
│      │ UserResponse │◀── 唯一出网 DTO ──│  (MVP: 日志实现) │  │
│      │  (白名单)     │                   └──────────────────┘  │
│      └──────────────┘                                          │
└────────────────────────────────────────────────────────────────┘
```

## 技术决策

| 决策项 | 选择 | 理由 | 替代方案 |
|---|---|---|---|
| 认证机制 | JWT：access 15min + refresh 7d | 前端 Vercel、后端自托管，天然跨域；无状态便于水平扩展 | Session + Cookie（需 CSRF 防护与跨域 Cookie 配置，部署更重） |
| 密码散列 | BCrypt strength 10 | Spring Security 内置，salt 内嵌于散列值，无需独立 salt 列 | PBKDF2 / Argon2（需额外依赖，且要求独立 salt 字段） |
| 持久化 | Spring Data JPA + H2（文件模式） | MVP 零外部依赖；后续换 PostgreSQL 仅改 `application.yml`，实体层不动 | MyBatis / JdbcTemplate |
| **令牌即时吊销** | **全局 `UserStatusFilter` 每请求校验状态** | 解决「JWT 无状态」与「锁定/注销需即时生效」的核心张力 | Redis 令牌黑名单（需引入 Redis，本 change 已排除） |
| **安全边界** | **白名单 DTO（`UserResponse`）** | 新字段默认不可见，结构性防泄露；测试可断言键集合严格相等 | Jackson `@JsonIgnore` 黑名单（新增敏感字段易遗漏） |
| 限流 | 内存滑动窗口计数器 | MVP 单实例自托管，零中间件依赖 | Bucket4j / Redis（多实例时再切） |
| 邮件投递 | `MailSender` 接口 + 日志实现 | 无 SMTP 凭据，避免 change 被阻塞；接口预留，替换实现不影响 spec | JavaMailSender + SMTP |
| 错误格式 | 统一信封 `error.code` + `error.message` | 机器码供前端分支与自动化断言，文案供人类阅读 | 直接返回裸字符串（不可分支） |

## 破解 email_unverified 死锁（方案 A）

按状态机规则，`EMAIL_UNVERIFIED` 登录返回 `403` 且**不签发令牌**。若验证流程依赖登录态，用户将永久卡死：

```
注册 → EMAIL_UNVERIFIED → 登录 → 403（无令牌）
                              ↓
              想验证邮箱？需登录 → 但登录被 403 拒绝  ☠️ 死锁
```

**方案 A（已定案）**：把邮箱验证做成**免鉴权旁路**，不依赖登录态。

```
注册 ──▶ 生成一次性 code ──▶ 邮件投递 https://.../verify?code=<code>
                                          │
                            用户点击（无需登录）│
                                          ▼
                              GET /api/auth/verify?code=<code>
                                          │
                              校验 code 有效性 + 时效
                                          ▼
                              status: EMAIL_UNVERIFIED → ACTIVE
                                          │
                                          ▼
                              code 置空（用后即焚）
                                          │
                                          ▼
                              用户可正常登录 → 200 ✅
```

关键点：
- `GET /api/auth/verify` 与 `POST /api/auth/resend-verification` 均为**免鉴权**端点，用户在 `403` 状态下仍可重发邮件。
- 「重发验证邮件」**恒定返回 `202 Accepted`**，无论邮箱是否存在——既防账号枚举，又防邮件轰炸。
- 由此，`403` 语义得以完整保留，同时状态机保证可达 `ACTIVE`。

## JWT 无状态 vs 锁定即时生效

这是本设计的核心张力，必须显式处理：

```
   用户持有效 access token（签名有效、未过期）
        │
        ▼
   账号被管理员锁定 / 用户自行注销
        │
        ├─ 纯 JWT 方案：token 仍有效至 15 分钟后过期 ❌ 违反状态机
        │
        └─ 本设计：UserStatusFilter 每请求回查当前状态 ✅ 即时拦截
```

| 手段 | 作用 | 代价 |
|---|---|---|
| `UserStatusFilter` 每请求校验状态 | 锁定 / 注销**即时**生效（下次请求即失败） | 每个需鉴权请求多一次用户查询 |
| access token 短 TTL（15 分钟） | 缩小「无状态窗口」上界 | 需配合 refresh 机制 |
| 短 TTL 状态缓存（如 30 秒，可选优化） | 降低数据库读压力 | 最坏情况有 30 秒延迟，可接受 |

> 状态缓存列为**可选优化**，MVP 直接查库即可（H2 本地查询开销极低）。若后续引入，需在 design 中补充缓存失效策略。

## 安全边界：白名单 DTO

```java
public record UserResponse(
    UUID id,
    String email,
    String displayName,
    String avatarUrl,
    String status,
    Instant createdAt
) {
    public static UserResponse from(User u) { /* 显式逐字段映射 */ }
}
```

**约束**：`User` 实体**永不**直接作为 Controller 返回值或响应体成员。所有出网用户数据必须经 `UserResponse.from(...)` 转换。

**回归护栏**（Jackson 序列化测试）：

```java
@Test
void userResponseNeverLeaksSecrets() {
    User u = fullyPopulatedUser(); // 含 passwordHash / salt / verificationCode
    String json = objectMapper.writeValueAsString(UserResponse.from(u));
    assertThat(json).doesNotContain(
        "password_hash", "passwordHash",
        "salt",
        "verification_code", "verificationCode"
    );
}
```

> **命名双覆盖**：DB 列为 snake_case（`password_hash`），Java 字段为 camelCase（`passwordHash`）。测试同时断言两种形式，防止 Jackson 命名策略变更导致护栏失效。

## API 设计

| 方法 | 路径 | 鉴权 | 说明 | 成功 | 主要错误 |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | 免 | 注册，创建 `EMAIL_UNVERIFIED` 用户 | `201` + `UserResponse` | `400` / `409` / `429` |
| POST | `/api/auth/login` | 免 | 登录，按状态返回精确码 | `200` + tokens | `401` / `403` / `423` / `429` |
| GET | `/api/auth/verify` | 免 | 邮箱验证（一次性 code） | `200` | `400` |
| POST | `/api/auth/resend-verification` | 免 | 重发验证邮件 | `202` | `429` |
| POST | `/api/auth/refresh` | 免 | 刷新 access token | `200` | `401` |
| POST | `/api/auth/logout` | 需 | 登出 | `204` | `401` |
| GET | `/api/auth/me` | 需 | 当前用户信息 | `200` + `UserResponse` | `401` / `423` |
| DELETE | `/api/auth/me` | 需 | 注销（软删除） | `204` | `401` |

**成功响应体（登录）**：

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "displayName": "Alice",
    "avatarUrl": null,
    "status": "ACTIVE",
    "createdAt": "2026-08-28T10:00:00Z"
  }
}
```

**错误响应体（统一信封）**：

```json
{ "error": { "code": "ACCOUNT_LOCKED", "message": "Account is temporarily locked. Try again later." } }
```

## 数据结构

### `User` 实体

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `UUID` | PK | 后端生成，不可客户端指定 |
| `email` | `varchar` | unique, not null | **小写归一化**后存储，唯一性判定同此 |
| `passwordHash` | `varchar` | not null | BCrypt（`$2a$` / `$2b$`），**禁止出网** |
| `salt` | `varchar` | nullable | 当前恒为空（BCrypt salt 内嵌）；保留以备算法切换，仍受安全边界约束 |
| `displayName` | `varchar` | not null | |
| `avatarUrl` | `varchar` | nullable | |
| `status` | `enum` | not null | `ACTIVE` / `LOCKED` / `DELETED` / `EMAIL_UNVERIFIED` |
| `verificationCode` | `varchar` | nullable | UUID v4，一次性，**禁止出网** |
| `verificationCodeExpiresAt` | `timestamp` | nullable | TTL 24h |
| `failedAttempts` | `int` | default 0 | 成功登录后重置 |
| `lockedUntil` | `timestamp` | nullable | 锁定截止时刻，超时自动解锁 |
| `createdAt` | `timestamp` | not null | |
| `updatedAt` | `timestamp` | not null | |
| `deletedAt` | `timestamp` | nullable | 软删除标记，非空即视为 `DELETED` |

### 状态机与迁移

```
                    ┌──────────┐
                    │ REGISTER │
                    └────┬─────┘
                         ▼
               ┌──────────────────┐
               │ EMAIL_UNVERIFIED │◀────────┐
               └────────┬─────────┘         │
                        │ GET /verify?code  │ 重发邮件（免鉴权）
                        │ （免鉴权，一次性）  │
                        ▼                   │
               ┌──────────────────┐         │
      ┌───────▶│      ACTIVE      │─────────┘
      │        └────┬────────┬────┘
      │             │        │
      │  连续失败 5 次│        │ DELETE /api/auth/me
      │             ▼        ▼        （软删除）
      │      ┌────────────┐  ┌─────────────────┐
      │      │   LOCKED   │  │     DELETED     │
      │      │ lockedUntil│  │  deletedAt 非空 │
      │      └──────┬─────┘  └─────────────────┘
      │             │              ▲
      │   15 分钟届满│              │ 终态，不可自行恢复
      └─────────────┘              │ （数据保留，邮箱仍占唯一约束）
                                   │
                            ADMIN 可手动锁定 ──┘
```

**迁移参数**：

| 迁移 | 触发条件 | 常量 |
|---|---|---|
| `EMAIL_UNVERIFIED` → `ACTIVE` | 有效一次性 code | `VERIFICATION_CODE_TTL_HOURS = 24` |
| `ACTIVE` → `LOCKED` | 连续失败达阈值 | `MAX_FAILED_ATTEMPTS = 5` |
| `LOCKED` → `ACTIVE` | 锁定时长届满 | `LOCK_DURATION_MINUTES = 15` |
| `ACTIVE` → `DELETED` | 用户主动注销 | 软删除，不可逆（需管理员介入） |

> **软删除语义**：用户行保留，`deletedAt` 写入时间戳；关联业务数据（攻略、评论等）**一并保留**。邮箱唯一约束**不释放**，防止同一邮箱重复注册。

## 限流设计

| 端点 | IP 维度 | (IP + email) 维度 |
|---|---|---|
| `POST /api/auth/register` | 5 次 / 1 小时 | — |
| `POST /api/auth/login` | 10 次 / 15 分钟 | 5 次 / 15 分钟 |
| `POST /api/auth/resend-verification` | 10 次 / 1 小时 | 3 次 / 24 小时 |

- 双维度**独立计数**，任一超限即 `429`。
- 超限请求**不执行密码校验**，不产生 `failedAttempts` 副作用。
- 限流仅施加于认证端点，不影响已登录用户的正常请求。

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| JWT 无法即时吊销 | 锁定 / 注销延迟生效，违反状态机 | `UserStatusFilter` 每请求回查状态 + access TTL 仅 15 分钟 |
| 账号枚举（保留精确状态码的代价） | `403` / `423` 泄露「邮箱已注册」 | 以**限流**为主要防护；「邮箱不存在」与 `DELETED` 共用 `401` 收窄泄露面；重发端点恒定 `202` |
| 内存限流在多实例部署下失效 | 横向扩展时限流被绕过 | MVP 单实例自托管可接受；多实例时切换 Redis（接口已按可替换设计） |
| 邮件服务未接 SMTP | 用户收不到验证链接，卡在 `EMAIL_UNVERIFIED` | MVP 日志输出 + 保留管理查询入口；`MailSender` 为接口，接 SMTP 不改 spec |
| H2 数据持久化 | 文件模式下重启不丢，但并发能力有限 | MVP 可接受；后续切 PostgreSQL 仅改数据源配置 |
| 时钟偏移影响 `lockedUntil` 判定 | 锁定提前 / 延迟解锁 | 统一使用服务器时间；不引入客户端时间参与判定 |
| BCrypt 计算开销 | 登录请求 CPU 占用 | strength 10 为业界平衡点；配合限流已足够 |
| 白名单 DTO 被绕过 | 有人直接返回 `User` 实体导致泄露 | Jackson 序列化测试 + Code Review 检查项：「Controller 返回值不得出现 `User` 实体类型」 |
