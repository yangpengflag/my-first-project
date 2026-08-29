## Why

WanderChina 的 `project.md` 已规划「用户模块」（个人中心 / 消息通知 / 站内信），三者全部依赖用户身份，但**认证能力至今为零**：后端 `pom.xml` 仅有 `spring-boot-starter-web`，`openspec/specs/` 下无任何 auth capability，`backend/src/main/java/com/mooc/backend/` 只有 `BackendApplication` 与 `HelloController`。身份是先决条件，不先落地 auth，后续任何用户域 change 都无法建立归属关系。

本 change 确立两条不可协商的基线：

1. **安全边界**——任何响应禁止泄露 `password_hash` / `salt` / `verification_code`。这三类字段一旦出网即为凭证级泄露，因此必须由**白名单 DTO 结构性保证**（新字段默认不可见），而非依赖人工维护的序列化黑名单。
2. **状态机**——用户生命周期收敛为 `ACTIVE` / `LOCKED` / `DELETED` / `EMAIL_UNVERIFIED` 四态，登录端点据此返回 `200` / `423` / `401` / `403`。该映射符合 HTTP 语义分层：`401` 表示认证不成立（身份已注销），`403` 表示认证成立但授权不足（邮箱未激活），`423 Locked` 表示身份成立但资源被临时锁定。

**本 change 破解了一个死锁**：若严格按「`EMAIL_UNVERIFIED` → `403`」实现，未验证用户既拿不到令牌、又无法调用需鉴权的「重发验证邮件」端点，将永久卡在 `EMAIL_UNVERIFIED`。解法（已定案为方案 A）是把邮箱验证设计为**免鉴权旁路**：验证链接携带一次性验证码，点击即激活，完全不依赖登录态。从而在保留 `403` 语义的同时保证状态机可达 `ACTIVE`。

## What Changes

### 后端变更（本 change 全部范围）

- **依赖新增**（`backend/pom.xml`）：`spring-boot-starter-security`、`spring-boot-starter-data-jpa`、`com.h2database:h2`(runtime)、JJWT（`jjwt-api` / `jjwt-impl` / `jjwt-jackson`）。
- **领域层**：新增 `User` 实体与 `UserStatus` 枚举；新增 `UserRepository`（JPA）。
- **安全边界层**：新增 `UserResponse` 白名单 DTO（`record`），作为**唯一**允许出网的用户表示；配套 Jackson 序列化白名单测试作为回归护栏。
- **业务层**：新增 `AuthService`（注册 / 登录 / 验证 / 重发 / 注销）、`PasswordHasher`（BCrypt 封装）、`TokenService`（JWT 签发与解析）、`MailSender`（MVP 为日志实现，预留接口）。
- **状态机守卫**：新增 `UserStatusFilter`，对全部需鉴权端点校验令牌对应用户的**当前**状态，状态非 `ACTIVE` 时按映射短路返回 `423` / `401`。
- **限流**：新增 `RateLimitFilter` 与内存滑动窗口 `RateLimiter`，按 IP 与 (IP + email) 双维度独立计数，施加于注册 / 登录 / 重发端点，超限返回 `429`。
- **控制器**：新增 `AuthController`（`/api/auth/**`）。
- **异常**：扩展 `GlobalExceptionHandler` 输出统一错误信封 `{"error":{"code":...,"message":...}}`。
- **测试**：`@WebMvcTest` 切片测试覆盖状态机四分支、安全边界断言、锁定阈值、软删除语义、限流阈值。

### 明确不包含（Out of Scope）

- ❌ **前端登录 / 注册 UI**：本 change 仅交付后端 API 契约，前端页面由后续 change 承载（前端当前仅有 homepage）。
- ❌ **OAuth / 社交登录**（Google / Apple / WeChat）。
- ❌ **忘记密码 / 密码重置**：虽属 auth 常见组成，但会引入新的敏感字段（`password_reset_token`）与邮件模板，独立 change 更合适。
- ❌ **真实 SMTP 邮件投递**：MVP 由 `MailSender` 日志实现占位，接口已预留，接 SMTP 时不影响本 spec。
- ❌ **MFA / 2FA**、❌ **RBAC 角色权限**（当前无角色需求）、❌ **令牌黑名单即时吊销**（改由状态过滤器解决，见 design）。
- ❌ **Redis**：限流与状态校验均走内存 / 数据库，避免引入外部中间件依赖。
- ❌ **会话管理 / 多设备管理 / 强制下线**。

### 规格变更

- 新增 `openspec/specs/auth-module/spec.md`（capability：`auth-module`）。

## Capabilities

### New Capabilities

- `auth-module`：定义 WanderChina 用户身份的注册、登录、邮箱验证、注销契约；确立四态生命周期与对应响应码映射；确立凭证类字段禁止出网的安全边界；确立防账号枚举的限流基线。作为个人中心、消息通知、站内信等后续用户域 change 的身份依赖。

### Modified Capabilities

- 无。

## Impact

- **依赖**：后端新增 4 组依赖（Security / JPA / H2 / JJWT），`pom.xml` 变更需走一次 `mvn compile` 验证。前端不受影响。
- **数据库**：首次引入持久化。MVP 用 H2 文件模式，JPA `ddl-auto=update` 自动建表；后续切换 PostgreSQL 仅需改 `application.yml` 数据源配置，实体层无需改动。
- **安全**：
  - 正面——白名单 DTO 结构性杜绝凭证泄露；限流封堵账号枚举与爆破；BCrypt 保证密码不可逆。
  - 需知——保留 4 个精确状态码意味着 `403` / `423` 会暴露「该邮箱已注册」这一事实（账号存在性）。本 change 的立场是：模糊化响应码属 security through obscurity（攻击者仍可通过注册端点枚举），真正有效的防护是限流，故**保留精确状态码 + 强制限流**。详见 design 「风险与缓解」。
- **状态一致性**：JWT 无状态与「锁定 / 注销即时生效」存在天然张力，由 `UserStatusFilter` 每次请求校验当前状态解决，代价是每个需鉴权请求多一次用户状态读取（可用短 TTL 缓存优化）。
- **跨模块**：`GET /api/auth/me` 与用户状态将成为后续个人中心、通知、站内信 change 的公共依赖；本 change 不预先实现这些模块的任何逻辑。
- **约束合规**：符合 `project.md`「业务逻辑一律在后端」原则；不涉及 BFF 层（`frontend/lib/backend.ts` 仍缺失，不在本 change 范围）。
- **团队**：引入 Spring Security 配置与 JWT 概念，属标准 Spring 生态，无特殊学习成本。
