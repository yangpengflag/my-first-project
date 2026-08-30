## Context

- 同 `post-comments`：Spring Boot 3.5 / Java 17 / 标准分层；`BaseEntity` 软删约定（仓储层 `AndDeletedFalse`，实体不加 `@SQLRestriction`）；响应 DTO 约定（BaseResponse + snake_case + WHITELISTED_FIELDS + 序列化测试）；JWT 主体即用户身份；统一错误信封。
- 限流：`auth/ratelimit` 已提供 `RateLimiter`（内存滑动窗口）。`RateLimitFilter` 当前仅作用于 auth 免鉴权端点，且在 `SecurityConfig` 过滤链中位于 **`JwtAuthFilter` 之前**（`RateLimitFilter → JwtAuthFilter → UserStatusFilter`）。因此 **`RateLimitFilter` 运行时 SecurityContext 尚未解析出主体**，不能在其内部按用户维度限流——投票限流须改在鉴权之后。
- 动机与范围见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 实现 `vote(postId, userId, voteType)` 三态语义（创建/取消/切换）与 `getVoteStats(postId)`（含当前用户投票态）。
- 一人一票：`@Table` 唯一约束 `(post_id, user_id)`。
- 取消 = 物理删除（保留唯一约束有效）；`Vote` 仍 `extends BaseEntity`。

**Non-Goals:**
- 不做投票历史 / 时间线。
- 不做按投票用户列表。
- 不做互动通知（独立 change）。
- 不区分「取消后再次投」与首次投的差异（语义一致）。

## Decisions

### D1. 包与分层
`com.mooc.backend.votes`：`api/`（`VotesController`、`VoteRequest`、`VoteResponse`、`VoteStatsResponse`）、`domain/`（`Vote`、`VoteType`）、`repository/`（`VoteRepository`）、`service/`（`VoteService`）、`exception/`（`VoteException`）。

### D2. 实体与一人一票约束
`Vote extends BaseEntity`；字段 `postId`、`userId`、`voteType`(`@Enumerated(STRING)`，长度小)。类级 `@Table(uniqueConstraints = @UniqueConstraint(name="uk_votes_post_user", columnNames={"post_id","user_id"}))`。**取消投票走 `repository.delete(vote)` 物理删除**，`deleted` 列恒 false（保留 `BaseEntity` 仅为复用 id/时间戳，契合需求「VoteEntity extends BaseEntity」）。软删不用于本实体——否则残留行会永久占用唯一槽位、阻断再次投票。

### D3. vote() 三态语义
`VoteService.vote(postId, userId, voteType, now)`：
1. `postRepository.findByIdAndDeletedFalse(postId)` 不存在 → `POST_NOT_FOUND`。
2. `voteRepository.findByPostIdAndUserId(postId, userId)`：
   - 空 → 新建 `Vote`（类型=requested），save，结果 `userVote = requested`。
   - 存在且 `type == requested` → `repository.delete(existing)`，结果 `userVote = null`（取消）。
   - 存在且 `type != requested` → `existing.setVoteType(requested); existing.touch(now); save`，结果 `userVote = requested`（切换）。
3. 返回 `VoteResponse { post_id, user_vote }`。

### D4. getVoteStats()
`VoteService.getVoteStats(postId, userId)`（`userId` 恒非 null，因该端点需 JWT）：
- `upCount = countByPostIdAndVoteType(postId, UP)`；`downCount = countByPostIdAndVoteType(postId, DOWN)`。
- `userVote = findByPostIdAndUserId` 取类型（无则 null）。
- 返回 `VoteStatsResponse { post_id, up_count, down_count, user_vote }`。

### D5. 并发安全（取消/切换的 check-then-act）
同一用户对同一帖高并发投票可能触发重复 `INSERT` 撞唯一约束。`VoteService.vote` 标记 `@Transactional`；若捕获 `DataIntegrityViolationException`（唯一约束冲突），在**同一事务内**重新 `findByPostIdAndUserId` 取当前真实状态并返回（幂等兜底），不让请求 500。测试须覆盖该路径。

### D6. 限流（鉴权后、复用 RateLimiter）
`RateLimitFilter` 位于 JWT 解析之前，无法获取 `userId`，故**不**在其中扩展投票限流。改为在鉴权之后施加：
- 在 `VotesController`（或注册在 `JwtAuthFilter` 之后的 `VoteRateLimitInterceptor`）注入既有 `RateLimiter` bean；限流键 `vote|user|{userId}`（来自 `currentUserId()`）。
- 超限时抛 `VoteException(ErrorCode.RATE_LIMITED)`，由 `GlobalExceptionHandler` 译为 `429`。
- 阈值写入 `RateLimitProperties.votePerUserPerMinute`（默认 ~10），`application.yml` 补默认值。
- `RateLimitFilter` 与 `auth` 免鉴权端点的既有行为**不变**。

### D7. DTO 与校验
- `VoteRequest`（record）：`voteType`(`@NotNull` 枚举或 `@Pattern(UP|DOWN)`)。
- `VoteResponse`（extends `BaseResponse`）：`post_id`、`user_vote`(String, 可 null)。`WHITELISTED_FIELDS` + 序列化测试。
- `VoteStatsResponse`（extends `BaseResponse`）：`post_id`、`up_count`(int)、`down_count`(int)、`user_vote`(String, 可 null)。`WHITELISTED_FIELDS` + 序列化测试。

### D8. 鉴权与错误码
- `VotesController.currentUserId()` 同 `PostsController`；未认证抛 `VoteException(ErrorCode.UNAUTHENTICATED)`。两个端点均位于 `anyRequest().authenticated()` 覆盖范围内（无需额外 SecurityConfig 放行）。
- 复用既有 `ErrorCode`：`UNAUTHENTICATED`(401)、`VALIDATION_FAILED`(400, voteType 非法)、`POST_NOT_FOUND`(404)、`RATE_LIMITED`(429)。**无需新增枚举值**。
- `GlobalExceptionHandler` 新增 `handleVoteException` 分支。

### D9. Schema 供给
`votes` 表 + 唯一约束；沿用现有供给机制。

### D10. API 契约
springdoc 注解 + 重新生成 `/v3/api-docs` + 更新前端 `openapi.json`。

## Risks / Trade-offs

- **[并发撞唯一约束]** → D5 `@Transactional` + 冲突兜底重读，保证最终一致与幂等；须以测试覆盖。
- **[物理删除与审计]** → 投票取消无需审计，物理删合理；若未来要留存投票历史，需新 change（加历史表）。
- **[限流维度]** → D6 改为鉴权后按用户维度，是 `RateLimitFilter` 过滤链位置约束下的正确做法；不影响 auth 端点限流。
- **[user_vote 恒非空]** → 因 stats 需 JWT，`user_vote` 必然有值（或 null 表示未投），前端据此展示中性态。
