## Why

帖子详情页需要点赞 / 点踩与实时计数。当前 `posts` capability 不含任何投票数据。引入 `post-votes` capability，以「一人一票（post_id, user_id 唯一）」模型支撑点赞 / 点踩切换与统计，计数直接驱动详情页的互动按钮状态。

## What Changes

- 新增 `post-votes` capability，HTTP 接口位于 `/api/posts/{postId}/vote` 与 `/api/posts/{postId}/vote/stats`：
  - `POST /api/posts/{postId}/vote` — 鉴权。body `{ vote_type: "UP" | "DOWN" }`。语义：`(不存在)→创建` / `(已存在且同类型)→取消(删除)` / `(已存在且异类型)→切换`。返回当前用户投票态 `user_vote`（UP/DOWN/null）。
  - `GET /api/posts/{postId}/vote/stats` — 鉴权（需 JWT）。返回 `{ post_id, up_count, down_count, user_vote }`；`user_vote` 由令牌主体计算（必然有值）。
- 新增 JPA 实体 `Vote`（继承 `BaseEntity`）：`postId`(UUID)、`userId`(UUID)、`voteType`(枚举 UP/DOWN)。`@Table(uniqueConstraints = @UniqueConstraint(name="uk_votes_post_user", columnNames={"post_id","user_id"}))` 保证一人一票。
- **取消投票 = 物理删除行**（非软删），以保留唯一约束有效性（`deleted` 列恒为 false；仍 `extends BaseEntity` 仅复用主键/时间戳，符合需求「VoteEntity extends BaseEntity」）。
- 白名单响应 DTO：`VoteResponse`（toggle 后状态）、`VoteStatsResponse`（统计），snake_case + 继承 `BaseResponse`。

无 **BREAKING** 变更（仅新增端点与数据表 `votes`）。

## Capabilities

### New Capabilities

- `post-votes`：帖子点赞 / 点踩的投票、取消、切换与统计；一人一票约束。

### Modified Capabilities

- `auth-module`（仅扩展）：`GlobalExceptionHandler` 新增 `VoteException` 映射（复用既有 `ErrorCode`：`UNAUTHENTICATED`/`VALIDATION_FAILED`/`POST_NOT_FOUND`/`RATE_LIMITED`，无需新增枚举值）。投票限流复用 `RateLimiter` 组件（在鉴权后按用户维度计数，详见 design D6），**不**改动 `RateLimitFilter`。

## Impact

- 新增数据表 `votes`（含唯一约束 `uk_votes_post_user`）；新增后端包 `com.mooc.backend.votes`（api / domain / repository / service / exception）。
- 依赖 `auth`（`User` 仅用于 `user_vote` 回填，可仅用 ID）、`common.BaseEntity`、`posts`（`postRepository.findByIdAndDeletedFalse` 校验帖存在）。
- 鉴权：投票需 JWT；统计读亦需 JWT（与"全部需要JWT"一致，且 `GET /api/posts/*/vote/stats` 当前不匹配公开匹配器，本就需鉴权）。
- 限流：`POST /vote` 复用 `auth/ratelimit` 的 `RateLimiter` 组件，在 **JwtAuthFilter 之后**（controller / 拦截器层）按用户维度计数；`RateLimitFilter` 本身**不动**（仍只保护免鉴权 auth 端点）。原因：`SecurityConfig` 过滤链顺序为 `RateLimitFilter → JwtAuthFilter → UserStatusFilter`，`RateLimitFilter` 运行时主体尚未解析，无法在其内做用户维度限流。
- API 契约：`/v3/api-docs` 重新生成并更新前端 `openapi.json`。
- 通知：被点赞通知不在本 change（独立 `notifications` change）。
