## Purpose

为帖子详情页提供点赞 / 点踩能力：一人一票约束下的投票、取消、切换与实时统计，计数驱动详情页互动按钮状态。

## ADDED Requirements

### Requirement: 投票数据模型与一人一票约束

系统 SHALL 以 `Vote` 实体（继承 `BaseEntity`）持久化投票，字段契约如下：
- `id`：UUID 主键（来自 BaseEntity）。
- `postId`：UUID，所属帖子，不可为 `null`。
- `userId`：UUID，投票用户，不可为 `null`。
- `voteType`：枚举，取值域严格限定为 `UP` / `DOWN`。

`Vote` 类 SHALL 声明 `@Table(uniqueConstraints = @UniqueConstraint(name="uk_votes_post_user", columnNames={"post_id","user_id"}))`，保证同一用户对同一帖子仅一行。**取消投票 SHALL 走物理删除**（非软删），以释放唯一约束槽位、允许该用户再次投票；`deleted` 列恒为 false。

#### Scenario: 一人一票唯一约束生效

- **WHEN** 同一用户对同一帖子尝试写入第二条 Vote 行
- **THEN** 数据库唯一约束 `uk_votes_post_user` 拒绝，应用层捕获冲突并返回当前真实投票态（不 500）

#### Scenario: 取消后允许再次投票

- **GIVEN** 用户 U 对帖子 P 有 UP 投票，随后取消（物理删除该行）
- **WHEN** U 再次对 P 投票（UP 或 DOWN）
- **THEN** 成功创建新行，无唯一约束冲突

---

### Requirement: 投票三态语义（创建 / 取消 / 切换）

`POST /api/posts/{postId}/vote` SHALL 依据当前用户既有投票执行：不存在→创建；已存在且类型相同→取消（删除）；已存在且类型不同→切换（改类型）。返回当前用户投票态 `user_vote`（UP/DOWN/null）。需鉴权，未鉴权返回 `401 UNAUTHENTICATED`；帖子不存在返回 `404 POST_NOT_FOUND`。

#### Scenario: 首次投票创建

- **WHEN** 用户对未投过票的帖子提交 `{ "vote_type": "UP" }`
- **THEN** 返回 `200 OK`，`user_vote` 为 `"UP"`，库中存在一行 (UP)

#### Scenario: 同类型再投取消

- **WHEN** 已投 UP 的用户再次提交 `{ "vote_type": "UP" }`
- **THEN** 返回 `200 OK`，`user_vote` 为 `null`，该行被物理删除

#### Scenario: 异类型切换

- **WHEN** 已投 UP 的用户提交 `{ "vote_type": "DOWN" }`
- **THEN** 返回 `200 OK`，`user_vote` 为 `"DOWN"`，行类型更新为 DOWN（未新增行）

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用 `POST /api/posts/{postId}/vote`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

---

### Requirement: 投票统计（需鉴权）

`GET /api/posts/{postId}/vote/stats` SHALL 返回 `{ post_id, up_count, down_count, user_vote }`。`up_count`/`down_count` 为该帖 UP/DOWN 总数；`user_vote` 为当前令牌用户的投票态（未投为 `null`）。该端点为需鉴权端点（未认证返回 `401 UNAUTHENTICATED`）。

#### Scenario: 已登录返回完整统计与 user_vote

- **GIVEN** 帖子 P 有 5 个 UP、2 个 DOWN，用户 U 投了 DOWN
- **WHEN** U 携带令牌调用 `GET /api/posts/{P.id}/vote/stats`
- **THEN** 返回 `200 OK`，`up_count=5`、`down_count=2`、`user_vote="DOWN"`

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用 `GET /api/posts/{postId}/vote/stats`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

---

### Requirement: 投票限流（鉴权后，按用户维度）

`POST /api/posts/{postId}/vote` SHALL 在鉴权之后按用户 ID 维度限流（默认 ≤ 10 次/分钟），超限返回 `429 RATE_LIMITED`。限流复用 `auth/ratelimit` 的 `RateLimiter` 组件，在 JWT 解析之后施加（不得在 `RateLimitFilter` 内，因其在 JWT 解析前运行）。

#### Scenario: 超限返回 429

- **WHEN** 同一登录用户在一分钟内超过阈值多次调用投票
- **THEN** 超限请求返回 `429`，`error.code` 为 `"RATE_LIMITED"`

---

### Requirement: 响应安全边界——白名单

`VoteResponse` / `VoteStatsResponse` SHALL 采用白名单 DTO 输出，字段严格限定为：`post_id` / `user_vote`（VoteResponse）、`post_id` / `up_count` / `down_count` / `user_vote`（VoteStatsResponse）。任何响应 SHALL NOT 包含 `deleted_at` 或任何用户隐私字段。

#### Scenario: 响应不含 deleted_at

- **WHEN** 投票 / 统计返回 `200`
- **THEN** 响应 JSON 中**不**出现 `deleted_at` / `deletedAt` 子串
