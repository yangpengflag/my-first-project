# Tasks: Auth 模块

> 全部任务遵循 TDD：每个 GREEN 步骤前必须先有对应的 RED 测试。
> 验收基线：`mvn test` 全绿，且安全边界序列化测试始终存在。

## Phase 1: 依赖与基础设施

- [x] 1.1 `backend/pom.xml` 新增 4 组依赖：`spring-boot-starter-security`、`spring-boot-starter-data-jpa`、`com.h2database:h2`(runtime)、JJWT(`jjwt-api`/`jjwt-impl`/`jjwt-jackson` 0.12.x)
- [x] 1.2 **验证**：执行 `mvn compile` 编译通过，依赖无冲突
- [x] 1.3 `application.yml` 配置 H2 文件模式数据源、JPA `ddl-auto=update`、JWT 密钥与 TTL（access 15min / refresh 7d）、BCrypt strength 10
- [x] 1.4 配置 `SecurityConfig`：放行 `/api/auth/register`、`/api/auth/login`、`/api/auth/verify`、`/api/auth/resend-verification`、`/api/auth/refresh`；其余 `/api/**` 需鉴权
- [x] 1.5 扩展 `GlobalExceptionHandler` 输出统一错误信封 `{"error":{"code":...,"message":...}}`

## Phase 2: 领域层与白名单 DTO（安全边界）

- [x] 2.1 **RED** `UserStatusTest`：断言枚举取值域严格为 `ACTIVE`/`LOCKED`/`DELETED`/`EMAIL_UNVERIFIED` 四者
- [x] 2.2 **GREEN** 实现 `UserStatus` 枚举
- [x] 2.3 **RED** `UserTest`：断言邮箱小写归一化、字段默认值（`failedAttempts=0`、`status=EMAIL_UNVERIFIED`）
- [x] 2.4 **GREEN** 实现 `User` 实体（含 `passwordHash`/`salt`/`verificationCode`/`failedAttempts`/`lockedUntil`/`deletedAt`）与 `UserRepository`
- [x] 2.5 **RED** `UserResponseSerializationTest`——**本 change 安全护栏核心**：
  - 构造填满全部字段的 `User`（含 `passwordHash`/`salt`/`verificationCode`）
  - 断言序列化键集合**严格等于** `{id, email, displayName, avatarUrl, status, createdAt}`
  - 断言输出不含 `password_hash`/`passwordHash`/`salt`/`verification_code`/`verificationCode`
- [x] 2.6 **GREEN** 实现 `UserResponse` record（白名单，逐字段显式映射）

## Phase 3: 密码与令牌

- [x] 3.1 **RED** `PasswordHasherTest`：断言散列以 `$2a$`/`$2b$` 开头；相同明文产生不同散列；`matches` 校验正确
- [x] 3.2 **GREEN** 实现 `PasswordHasher`（BCrypt strength 10）
- [x] 3.3 **RED** `TokenServiceTest`：断言签发可解析、篡改签名被拒、过期令牌被拒
- [x] 3.4 **GREEN** 实现 `TokenService`（access 15min / refresh 7d）
- [x] 3.5 **RED** `MailSenderTest`：断言注册后收到一次投递请求（MVP 日志实现可断言调用次数）
- [x] 3.6 **GREEN** 实现 `MailSender` 接口 + `LoggingMailSender` 实现

## Phase 4: 注册与邮箱验证（破解 email_unverified 死锁 · 方案 A）

- [x] 4.1 **RED** `AuthControllerRegisterTest`（`@WebMvcTest`）：
  - 合法注册 → `201`，`user.status == EMAIL_UNVERIFIED`，**无 token 字段**
  - 邮箱重复（含大小写变体）→ `409` `EMAIL_ALREADY_REGISTERED`
  - 弱密码 / 非法邮箱 → `400` `VALIDATION_FAILED`
  - 响应体不含任何敏感键名
- [x] 4.2 **GREEN** 实现注册逻辑（`AuthService.register`）
- [x] 4.3 **RED** `AuthControllerVerifyTest`：
  - 有效 code → `200`，状态转 `ACTIVE`，code 置空（用后即焚）
  - 无效 / 过期 / 已使用的 code → `400` `INVALID_VERIFICATION_CODE`（三态同码，不泄露细节）
  - **免鉴权**：请求不带 `Authorization` 头仍可成功
- [x] 4.4 **GREEN** 实现验证逻辑（`AuthService.verifyEmail`）
- [x] 4.5 **RED** `AuthControllerResendTest`：
  - 已注册未验证邮箱 → `202` 且实际投递
  - 不存在邮箱 / 已验证邮箱 → 仍为 `202`，**不投递**
- [x] 4.6 **GREEN** 实现重发逻辑（`AuthService.resendVerification`）
- [x] 4.7 **RED** 死锁回归测试：`EMAIL_UNVERIFIED` 用户登录被 `403` 后，仍可经重发 + 验证链路激活并成功登录 `200`

## Phase 5: 登录状态机（核心）

- [x] 5.1 **RED** `AuthControllerLoginTest` 四态分支：
  - `ACTIVE` + 正确密码 → `200`，含 accessToken/refreshToken，`failedAttempts` 归零
  - `LOCKED` + **正确**密码 → `423` `ACCOUNT_LOCKED`，无 token
  - `DELETED` + 正确密码 → `401` `ACCOUNT_DELETED`，无 token
  - `EMAIL_UNVERIFIED` + 正确密码 → `403` `EMAIL_NOT_VERIFIED`，无 token
- [x] 5.2 **GREEN** 实现登录逻辑（`AuthService.login`），按状态分支返回精确响应码
- [x] 5.3 **RED** 断言邮箱不存在 → `401` `INVALID_CREDENTIALS`，与 `DELETED` 共用同码
- [x] 5.4 **RED** 断言密码错误 → `401` `INVALID_CREDENTIALS` 且 `failedAttempts` 自增

## Phase 6: 账号锁定策略

- [x] 6.1 **RED** `AccountLockoutTest`：连续失败至 `MAX_FAILED_ATTEMPTS=5` → 状态转 `LOCKED`，`lockedUntil` = now + 15min
- [x] 6.2 **GREEN** 实现锁定判定（**优先于密码校验**）
- [x] 6.3 **RED** 断言锁定期间提交**正确**密码仍返回 `423`，且 `failedAttempts` 不再递增
- [x] 6.4 **RED** 断言 `lockedUntil` 届满后提交正确密码 → `200`，状态恢复 `ACTIVE`，`lockedUntil`/`failedAttempts` 清空
- [x] 6.5 **GREEN** 实现自动解锁逻辑

## Phase 7: 软删除

- [x] 7.1 **RED** `AccountDeletionTest`：`DELETE /api/auth/me` → `204`；用户行**仍存在**，`status=DELETED`，`deletedAt` 非空
- [x] 7.2 **GREEN** 实现软删除逻辑
- [x] 7.3 **RED** 断言软删除后：登录 → `401` `ACCOUNT_DELETED`；同邮箱重新注册 → `409`

## Phase 8: 全局状态拦截（锁定 / 注销即时生效）

- [x] 8.1 **RED** `UserStatusFilterTest`：
  - 持有有效令牌但用户被锁定 → `GET /api/auth/me` 返回 `423`
  - 持有有效令牌但用户被软删除 → 返回 `401`
  - 无令牌 / 令牌无效 → `401` `UNAUTHENTICATED`
- [x] 8.2 **GREEN** 实现 `UserStatusFilter` 并注册到过滤链
- [x] 8.3 **RED** 断言状态校验**优先于业务处理**（Controller 方法未被执行）

## Phase 9: 限流（防账号枚举）

- [x] 9.1 **RED** `RateLimiterTest`：断言 IP 维度与 (IP + email) 维度独立计数，滑动窗口正确过期
- [x] 9.2 **GREEN** 实现 `RateLimiter`（内存滑动窗口）
- [x] 9.3 **RED** `RateLimitFilterTest`：
  - 登录 IP 维度超限（10 次 / 15min）→ `429` `RATE_LIMITED`
  - (IP + email) 维度超限（5 次 / 15min）→ `429`，即使 IP 额度尚余
  - 超限请求**不**产生 `failedAttempts` 副作用
  - 重发端点 (IP + email) 超限（3 次 / 24h）→ `429`
- [x] 9.4 **GREEN** 实现 `RateLimitFilter` 并施加于注册 / 登录 / 重发端点
- [x] 9.5 **RED** 断言限流**不**影响已登录用户的正常请求（`/api/auth/me` 高频调用仍 `200`）

## Phase 10: 收尾与验收

- [x] 10.1 执行 `mvn test`，确认全量测试绿灯
- [x] 10.2 **安全边界复查**：`grep -rn "passwordHash\|password_hash\|salt\|verificationCode" backend/src/main/java/**/*Controller*.java` 确认无实体直接出网
- [x] 10.3 **日志复查**：确认注册 / 登录流程日志中无明文密码
- [x] 10.4 更新 `backend/README.md`：记录新增端点、状态机映射表、限流阈值、H2 与邮件 MVP 限制
- [x] 10.5 更新 `openspec/project.md`：在「用户模块」补充「注册 / 登录 / 邮箱验证 / 注销」条目，并在术语表登记 `UserStatus` 四态
