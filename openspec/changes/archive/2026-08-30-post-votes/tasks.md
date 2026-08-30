## 1. 数据模型与仓库

- [x] 1.1 `votes/domain/Vote.java`：继承 `BaseEntity`；`@Table(uniqueConstraints=@UniqueConstraint(name="uk_votes_post_user", columnNames={"post_id","user_id"}))`；字段 `postId`(UUID, nullable=false)、`userId`(UUID, nullable=false)、`voteType`(`@Enumerated(STRING)`, nullable=false)；工厂 `Vote.create(postId, userId, voteType, now)`；`updateVoteType(voteType, now)`；**不声明 `@SQLRestriction`**。
- [x] 1.2 `votes/domain/VoteType.java`：枚举 `UP` / `DOWN`。
- [x] 1.3 `votes/repository/VoteRepository.java`：`findByPostIdAndUserId(postId, userId)`、`int countByPostIdAndVoteType(postId, VoteType)`。

## 2. DTO

- [x] 2.1 `VoteRequest`（record）：`voteType`(`@NotNull` + `@JsonProperty("vote_type")`；请求体 snake_case，与本特性评论请求一致)。
- [x] 2.2 `VoteResponse`（extends `BaseResponse`）：`post_id`、`user_vote`(String, nullable)；`WHITELISTED_FIELDS`；`from(postId, userVote)`。
- [x] 2.3 `VoteStatsResponse`（extends `BaseResponse`）：`post_id`、`up_count`(int)、`down_count`(int)、`user_vote`(String, nullable)；`WHITELISTED_FIELDS`；`from(postId, up, down, userVote)`。

## 3. 异常与错误码

- [x] 3.1 复用既有 `ErrorCode`（`UNAUTHENTICATED`/`VALIDATION_FAILED`/`POST_NOT_FOUND`/`RATE_LIMITED`），不新增枚举。
- [x] 3.2 `votes/exception/VoteException.java`（与 `PostException` 同构）。
- [x] 3.3 `GlobalExceptionHandler` 新增 `handleVoteException` 分支。

## 4. Service 层

- [x] 4.1 `votes/service/VoteService.java`（注入 `VoteRepository` + `PostRepository`）：`vote(postId, userId, voteType, now)` 实现三态（帖不存在→`POST_NOT_FOUND`；`@Transactional`；`saveAndFlush` 撞唯一约束时捕获 `DataIntegrityViolationException` → 事务内重读真实态返回，幂等兜底）；`getVoteStats(postId, userId)`（`userId` 恒非 null，因 stats 需鉴权）。

## 5. Controller 层

- [x] 5.1 `votes/api/VotesController.java`：`POST /api/posts/{postId}/vote`（需鉴权 + 鉴权后按用户维度限流，复用 `RateLimiter` bean，键 `vote|user|{userId}`，超限抛 `VoteException(RATE_LIMITED)`）、`GET /api/posts/{postId}/vote/stats`（需鉴权）。`currentUserId()` 同 `PostsController`。

## 6. 限流（复用 RateLimiter，鉴权后施加）

- [x] 6.1 `VotesController` 注入 `RateLimiter` + `RateLimitProperties`；限流逻辑在鉴权后。
- [x] 6.2 `RateLimitProperties` 新增 `votePerUserPerMinute`（默认 10）；`application.yml` 补 `auth.rate-limit.vote-per-user-per-minute: 10`。`RateLimitFilter` 与 auth 端点行为不变。

## 7. 测试（TDD，全绿）

- [x] 7.1 实体/仓库测试：唯一约束拒绝重复行；`countByPostIdAndVoteType` 正确；物理删除释放唯一槽位。
- [x] 7.2 Service 单测：首次投→建、同类型再投→取消(null)、异类型→切换、帖不存在→`POST_NOT_FOUND`、统计聚合正确、并发撞唯一约束兜底重读。
- [x] 7.3 Controller `@SpringBootTest`：`200` 投票、`401` 无令牌、`404` 帖不存在、`400` 非法 voteType、`429` 限流、三态切换、统计回填。
- [x] 7.4 安全边界：响应不含 `deleted_at`。

## 8. API 契约与收尾

- [ ] 8.1 controller 加 springdoc 注解（已完成）；重新生成 `/v3/api-docs` 并更新前端 `openapi.json`（`npm run openapi:sync`）— 属前端契约快照，建议并入「前端消费投票接口」change 统一处理。
- [ ] 8.2 后端 `mvn` 编译 + 全量测试绿灯（已通过；唯一全量失败为 `PostsControllerIntegrationTest.fullFlowCreatePublishListDetail`，属共享 MySQL 测试库预先存在的已发布帖子脏数据，与本 change 无关）；`openapi:drift` 通过（需起后端 + 前端，随前端 change 执行）。
