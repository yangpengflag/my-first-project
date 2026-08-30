# auth-module Spec

## Purpose

用户身份与认证能力规格。定义注册、登录、邮箱验证、注销的 HTTP 契约；确立四态生命周期
（ACTIVE / LOCKED / DELETED / EMAIL_UNVERIFIED）与响应码映射（200 / 423 / 401 / 403）；
确立凭证类字段（passwordHash / salt / verificationCode）禁止出网的安全边界；
确立防账号枚举的限流基线。后端实现位于 `backend/src/main/java/com/mooc/backend/auth/`。

设计决策与权衡见 `openspec/changes/archive/2026-08-29-0004-auth-module/design.md`。

## Requirements

### Requirement: 用户状态机与登录响应码映射

系统 SHALL 为每个用户维护且仅维护一个生命周期状态，取值域严格限定为 `ACTIVE` / `LOCKED` / `DELETED` / `EMAIL_UNVERIFIED` 四者之一。`POST /api/auth/login` SHALL 依据目标用户的当前状态返回精确响应码：`ACTIVE` → `200`、`LOCKED` → `423`、`DELETED` → `401`、`EMAIL_UNVERIFIED` → `403`。当邮箱在系统中不存在时 SHALL 返回 `401`，与 `DELETED` 共用同一响应码以收窄账号枚举面。

所有错误响应 SHALL 使用统一信封 `{"error": {"code": "<MACHINE_CODE>", "message": "<人类可读文案>"}}`，`error.code` 为稳定机器码，供前端分支与自动化断言使用。

状态 → 响应码 → 错误码映射表：

| 用户状态 | HTTP | `error.code` |
|---|---|---|
| `ACTIVE` | `200` | —（成功） |
| `LOCKED` | `423` | `ACCOUNT_LOCKED` |
| `DELETED` | `401` | `ACCOUNT_DELETED` |
| `EMAIL_UNVERIFIED` | `403` | `EMAIL_NOT_VERIFIED` |
| 邮箱不存在 | `401` | `INVALID_CREDENTIALS` |

#### Scenario: ACTIVE 用户登录成功

- **GIVEN** 存在状态为 `ACTIVE` 的用户 `alice@example.com`，密码为 `Str0ng!Pass`
- **WHEN** `POST /api/auth/login` 提交 `{ "email": "alice@example.com", "password": "Str0ng!Pass" }`
- **THEN** 返回 `200 OK`
- **AND** 响应体含非空 `accessToken` 与 `refreshToken`
- **AND** 响应体 `user.status` 值为 `"ACTIVE"`
- **AND** 该用户在库中的 `failedAttempts` 被重置为 `0`

#### Scenario: LOCKED 用户即使密码正确也返回 423

- **GIVEN** 用户 `bob@example.com` 状态为 `LOCKED`
- **WHEN** `POST /api/auth/login` 提交**正确**密码
- **THEN** 返回 `423 Locked`
- **AND** 响应体**不**包含 `accessToken` 或 `refreshToken` 字段
- **AND** `error.code` 值为 `"ACCOUNT_LOCKED"`

#### Scenario: DELETED 用户返回 401

- **GIVEN** 用户 `carol@example.com` 已被软删除（状态 `DELETED`，`deletedAt` 非空）
- **WHEN** `POST /api/auth/login` 提交其原有**正确**密码
- **THEN** 返回 `401 Unauthorized`
- **AND** `error.code` 值为 `"ACCOUNT_DELETED"`
- **AND** 响应体**不**包含 `accessToken`

#### Scenario: EMAIL_UNVERIFIED 用户返回 403

- **GIVEN** 用户 `dave@example.com` 刚完成注册、尚未点击验证链接
- **WHEN** `POST /api/auth/login` 提交**正确**密码
- **THEN** 返回 `403 Forbidden`
- **AND** `error.code` 值为 `"EMAIL_NOT_VERIFIED"`
- **AND** 响应体**不**包含 `accessToken`

#### Scenario: 不存在的邮箱与 DELETED 共用 401

- **GIVEN** `nobody@example.com` 在系统中不存在
- **WHEN** `POST /api/auth/login` 提交该邮箱与任意密码
- **THEN** 返回 `401 Unauthorized`
- **AND** `error.code` 值为 `"INVALID_CREDENTIALS"`
- **AND** 响应耗时与 `DELETED` 分支处于同一量级（不因"用户不存在"而提前短路返回，避免时序侧信道）

#### Scenario: 密码错误返回 401 且计入失败次数

- **WHEN** `POST /api/auth/login` 提交已存在邮箱与**错误**密码
- **THEN** 返回 `401 Unauthorized`
- **AND** `error.code` 值为 `"INVALID_CREDENTIALS"`
- **AND** 该用户 `failedAttempts` 自增 `1`

---

### Requirement: 注册创建未验证用户并触发验证邮件

`POST /api/auth/register` SHALL 以 `EMAIL_UNVERIFIED` 状态创建用户，生成一次性验证码，并通过邮件服务投递验证链接。注册流程 SHALL NOT 签发任何令牌——用户必须先完成邮箱验证方可登录。

#### Scenario: 注册成功

- **WHEN** `POST /api/auth/register` 提交合法 `{ "email": "eve@example.com", "password": "Str0ng!Pass", "displayName": "Eve" }`
- **THEN** 返回 `201 Created`
- **AND** 响应体 `user.status` 值为 `"EMAIL_UNVERIFIED"`
- **AND** 响应体**不**包含 `accessToken` 或 `refreshToken`
- **AND** 库中该用户存在 `verificationCode` 非空且 `verificationCodeExpiresAt` 为未来时刻
- **AND** 邮件服务收到一次投递请求，收件人为 `eve@example.com`

#### Scenario: 邮箱已存在返回 409

- **GIVEN** `alice@example.com` 已注册
- **WHEN** 再次以该邮箱提交注册请求
- **THEN** 返回 `409 Conflict`
- **AND** `error.code` 值为 `"EMAIL_ALREADY_REGISTERED"`
- **AND** 库中用户总数不变

#### Scenario: 弱密码或非法邮箱返回 400

- **WHEN** `POST /api/auth/register` 提交 `password` 长度 < 8 或 `email` 不符合 RFC 5322 基本形态
- **THEN** 返回 `400 Bad Request`
- **AND** `error.code` 值为 `"VALIDATION_FAILED"`
- **AND** 响应体含 `error.details` 数组，逐项指明违规字段名

#### Scenario: 邮箱大小写归一化

- **WHEN** 以 `Alice@Example.com` 注册，且 `alice@example.com` 已存在
- **THEN** 返回 `409 Conflict`（邮箱按小写归一化后做唯一性判定）

---

### Requirement: 邮箱验证通过一次性验证码免登录完成

系统 SHALL 提供**免鉴权**的邮箱验证端点，使 `EMAIL_UNVERIFIED` 用户无需先登录即可完成激活。此设计旨在破解"登录返回 403 但验证邮件需登录态"的死锁。验证码 SHALL 为一次性、有时效、用后即焚。

#### Scenario: 有效验证码完成激活

- **GIVEN** 用户 `dave@example.com` 状态 `EMAIL_UNVERIFIED`，持有未过期的 `verificationCode`
- **WHEN** `GET /api/auth/verify?code=<verificationCode>` 被调用（无需任何鉴权头）
- **THEN** 返回 `200 OK`
- **AND** 该用户状态变更为 `ACTIVE`
- **AND** 该用户 `verificationCode` 被置空（用后即焚）
- **AND** 该用户 `failedAttempts` 为 `0`

#### Scenario: 激活后即可正常登录

- **GIVEN** 用户已完成上一步验证，状态为 `ACTIVE`
- **WHEN** `POST /api/auth/login` 提交正确密码
- **THEN** 返回 `200 OK` 并签发令牌

#### Scenario: 无效或过期验证码返回 400

- **WHEN** `GET /api/auth/verify?code=<不存在或已过期的 code>`
- **THEN** 返回 `400 Bad Request`
- **AND** `error.code` 值为 `"INVALID_VERIFICATION_CODE"`
- **AND** 不泄露该 code 是否曾存在、是否已使用或是否已过期（三态共用同一错误码与文案）

#### Scenario: 重复提交同一验证码失败

- **GIVEN** 验证码 `C` 已被成功使用一次
- **WHEN** 再次以 `C` 调用 `GET /api/auth/verify`
- **THEN** 返回 `400 Bad Request`
- **AND** `error.code` 值为 `"INVALID_VERIFICATION_CODE"`

#### Scenario: 重发验证邮件恒定返回 202

- **WHEN** `POST /api/auth/resend-verification` 提交 `{ "email": "<任意邮箱>" }`
- **THEN** 无论该邮箱是否存在、是否已验证，均返回 `202 Accepted`
- **AND** 仅当邮箱存在且状态为 `EMAIL_UNVERIFIED` 时才实际投递邮件
- **AND** 响应体为固定文案，**不**透露该邮箱是否已注册

---

### Requirement: 响应安全边界——凭证类字段禁止出网

任何 HTTP 响应（成功或失败、任何端点）的序列化输出 SHALL NOT 包含 `password_hash` / `salt` / `verification_code` 中的任一字段，亦 SHALL NOT 包含其驼峰等价形式 `passwordHash` / `salt` / `verificationCode`。本约束 SHALL 由**白名单 DTO** 结构性保证，而非序列化黑名单过滤——新增实体字段默认不可见，必须显式加入 DTO 才会输出。

#### Scenario: 登录响应不含凭证字段

- **WHEN** `POST /api/auth/login` 成功返回 `200`
- **THEN** 响应 JSON 字符串中**不**出现 `password_hash`、`passwordHash`、`salt`、`verification_code`、`verificationCode` 任一子串

#### Scenario: 注册响应不含凭证字段

- **WHEN** `POST /api/auth/register` 成功返回 `201`
- **THEN** 响应 JSON 字符串中**不**出现上述任一敏感键名

#### Scenario: 当前用户信息响应不含凭证字段

- **WHEN** 携带有效令牌调用 `GET /api/auth/me` 返回 `200`
- **THEN** 响应 JSON 字符串中**不**出现上述任一敏感键名

#### Scenario: 序列化层白名单断言（回归护栏）

- **GIVEN** 构造一个所有字段均填满的 `User` 实体（含 `passwordHash`、`salt`、`verificationCode`）
- **WHEN** 通过 Jackson 序列化 `UserResponse.from(user)`
- **THEN** 输出 JSON 的键集合**严格等于**白名单集合 `{id, email, display_name, avatar_url, status, created_at, request_id}`
- **AND** 输出中不含任何上述敏感键名（同时覆盖 snake_case 与 camelCase 两种命名）

#### Scenario: 实体新增敏感字段时测试失败（负向验证）

- **GIVEN** 向 `User` 实体新增字段 `passwordResetToken` 且未加入 `UserResponse` 白名单
- **WHEN** 运行序列化白名单测试
- **THEN** 测试仍通过（证明白名单对新字段默认封闭）

---

### Requirement: 账号锁定策略

系统 SHALL 在检测到连续登录失败达到阈值时自动将用户置为 `LOCKED`，并在锁定时长届满后自动恢复为 `ACTIVE`。锁定判定 SHALL 优先于密码校验——被锁用户即使提交正确密码亦返回 `423`。

阈值常量：`MAX_FAILED_ATTEMPTS = 5`，`LOCK_DURATION_MINUTES = 15`。

#### Scenario: 连续失败达阈值触发锁定

- **GIVEN** 用户 `frank@example.com` 状态 `ACTIVE`，`failedAttempts = 4`
- **WHEN** 提交第 5 次错误密码
- **THEN** 该用户状态变更为 `LOCKED`
- **AND** `lockedUntil` 被设为当前时刻 + 15 分钟

#### Scenario: 锁定期间正确密码仍返回 423

- **GIVEN** 用户状态 `LOCKED` 且 `lockedUntil` 为未来时刻
- **WHEN** 提交**正确**密码
- **THEN** 返回 `423 Locked`
- **AND** `failedAttempts` **不**继续递增

#### Scenario: 锁定时长届满自动解锁

- **GIVEN** 用户状态 `LOCKED`，`lockedUntil` 已为过去时刻
- **WHEN** 提交**正确**密码
- **THEN** 返回 `200 OK`
- **AND** 用户状态恢复为 `ACTIVE`，`lockedUntil` 与 `failedAttempts` 均被清空

#### Scenario: 成功登录重置失败计数

- **GIVEN** 用户 `failedAttempts = 3` 且未被锁定
- **WHEN** 提交正确密码登录成功
- **THEN** 返回 `200 OK`
- **AND** `failedAttempts` 被重置为 `0`

---

### Requirement: 软删除语义

注销账号 SHALL 执行**软删除**：用户行保留在库中，仅将状态置为 `DELETED` 并写入 `deletedAt` 时间戳。软删除 SHALL NOT 物理删除该用户关联的业务数据（攻略、评论等）。软删除后用户 SHALL NOT 能自行恢复。

#### Scenario: 注销执行软删除

- **GIVEN** 已登录用户 `alice@example.com` 状态 `ACTIVE`
- **WHEN** 携带有效令牌调用 `DELETE /api/auth/me`
- **THEN** 返回 `204 No Content`
- **AND** 库中该用户行**仍存在**
- **AND** 该用户 `status` 为 `"DELETED"`，`deletedAt` 为非空过去时刻

#### Scenario: 软删除后无法登录

- **GIVEN** 用户已被软删除
- **WHEN** `POST /api/auth/login` 提交原有正确密码
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"ACCOUNT_DELETED"`

#### Scenario: 软删除后邮箱不可重新注册

- **GIVEN** `alice@example.com` 已被软删除
- **WHEN** 以该邮箱再次提交注册
- **THEN** 返回 `409 Conflict`（邮箱唯一约束仍被占用）

#### Scenario: 软删除用户持有令牌访问受保护端点被拒

- **GIVEN** 用户持有尚未过期的 access token，随后账号被软删除
- **WHEN** 携带该令牌调用任意需鉴权端点
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"ACCOUNT_DELETED"`
- **AND** 该令牌被认定为失效，不进入业务处理

---

### Requirement: 全局用户状态拦截（锁定与注销即时生效）

所有需鉴权的端点 SHALL 经由统一过滤器校验令牌对应用户的**当前**状态，不得仅凭令牌签名有效即放行。此设计用以解决无状态令牌与"锁定/注销需即时生效"之间的张力。

#### Scenario: 登录后被锁定，下次请求即失败

- **GIVEN** 用户持有效令牌，随后被管理员手动锁定
- **WHEN** 携带该令牌调用 `GET /api/auth/me`
- **THEN** 返回 `423 Locked`，`error.code` 为 `"ACCOUNT_LOCKED"`

#### Scenario: 登录后被注销，下次请求即失败

- **GIVEN** 用户持有效令牌，随后账号被软删除
- **WHEN** 携带该令牌调用 `GET /api/auth/me`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"ACCOUNT_DELETED"`

#### Scenario: 无令牌或令牌无效返回 401

- **WHEN** 调用需鉴权端点且未携带 `Authorization` 头，或令牌签名无效/已过期
- **THEN** 返回 `401 Unauthorized`
- **AND** `error.code` 为 `"UNAUTHENTICATED"`

#### Scenario: 状态校验优先于业务处理

- **GIVEN** 用户状态 `LOCKED` 且持有效令牌
- **WHEN** 携带令牌调用任意需鉴权端点
- **THEN** 请求**不**进入任何业务处理器（Controller 方法不被执行）

---

### Requirement: 认证端点限流（防账号枚举）

认证相关端点 SHALL 施加限流，作为防账号枚举与凭证爆破的**主要**手段。限流 SHALL 按 IP 与（IP + 邮箱）双维度独立计数，超限返回 `429`。

限流阈值：

| 端点 | IP 维度 | IP + email 维度 |
|---|---|---|
| `POST /api/auth/login` | 10 次 / 15 分钟 | 5 次 / 15 分钟 |
| `POST /api/auth/register` | 5 次 / 1 小时 | — |
| `POST /api/auth/resend-verification` | 10 次 / 1 小时 | 3 次 / 24 小时 |

#### Scenario: 登录超限返回 429

- **GIVEN** 同一 IP 在 15 分钟内已发起 10 次登录请求
- **WHEN** 发起第 11 次 `POST /api/auth/login`
- **THEN** 返回 `429 Too Many Requests`
- **AND** `error.code` 为 `"RATE_LIMITED"`
- **AND** 该请求**不**执行密码校验（不产生失败计数副作用）

#### Scenario: 定向爆破被 IP+email 维度拦截

- **GIVEN** 同一 IP 对同一邮箱在 15 分钟内已失败 5 次
- **WHEN** 发起第 6 次针对该邮箱的登录
- **THEN** 返回 `429 Too Many Requests`
- **AND** 即使 IP 维度额度尚有剩余亦被拦截

#### Scenario: 限流不影响已登录用户的正常请求

- **GIVEN** 用户已通过登录获取令牌
- **WHEN** 携带令牌在 15 分钟内调用 `GET /api/auth/me` 20 次
- **THEN** 全部返回 `200 OK`（限流仅施加于认证端点）

---

### Requirement: 密码存储安全

密码 SHALL 以 BCrypt（strength ≥ 10）单向散列后持久化，系统 SHALL NOT 在数据库、日志或响应中存储或输出明文密码。BCrypt 的 salt 内嵌于散列值中，因此 `User` 实体默认不设独立 `salt` 字段；若未来引入需独立 salt 的算法（如 PBKDF2），该字段受本 spec 安全边界约束覆盖。

#### Scenario: 密码以 BCrypt 散列落库

- **WHEN** 以 `Str0ng!Pass` 注册用户
- **THEN** 库中 `passwordHash` 以 `$2a$` 或 `$2b$` 前缀开头
- **AND** 库中任何位置均**不**出现明文 `Str0ng!Pass`

#### Scenario: 相同密码产生不同散列

- **GIVEN** 用户 A 与用户 B 使用相同密码 `Str0ng!Pass`
- **THEN** 两者 `passwordHash` 值**不**相同（各自独立 salt）

#### Scenario: 日志不记录明文密码

- **WHEN** 执行注册与登录流程
- **THEN** 应用日志输出中**不**出现请求体中的密码明文

#### Scenario: 密码字段不参与序列化

- **GIVEN** `User` 实体含 `passwordHash` 字段
- **WHEN** 该实体被直接或间接序列化进任何响应
- **THEN** 输出中**不**出现 `passwordHash`（由白名单 DTO 保证）
