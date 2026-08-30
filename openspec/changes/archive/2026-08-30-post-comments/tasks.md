## 1. 数据模型与仓库

- [x] 1.1 `comments/domain/Comment.java`：继承 `BaseEntity`；字段 `postId`(UUID, nullable=false)、`userId`(UUID, nullable=false)、`content`(`columnDefinition="TEXT"`, nullable=false)、`parentCommentId`(UUID, 可空)；工厂 `Comment.create(postId, userId, content, parentCommentId, now)` 注入 id/now；`isTopLevel()` = `parentCommentId == null`；`softDelete(now)`；**不声明 `@SQLRestriction`**。
- [x] 1.2 `comments/repository/CommentRepository.java`：继承 `JpaRepository<Comment,UUID>`，方法：`findByPostIdAndParentCommentIdIsNullAndDeletedFalse(postId, Pageable)`、`findByParentCommentIdAndDeletedFalse(parentId, Pageable)`、`findByIdAndDeletedFalse(id)`、`countByParentCommentIdAndDeletedFalse(parentId)`、`findByPostIdAndIdAndDeletedFalse(postId, id)`（校验回复父评论同帖）、`findAllByParentCommentIdAndDeletedFalse(parentId)`（级联软删回复用）。

## 2. DTO

- [x] 2.1 `CreateCommentRequest`（record）：`@NotBlank` `content`、长度上限 `@Size(max = MAX_COMMENT_LENGTH=2000)`；可空 `parentCommentId`(UUID，JSON 名 `parent_comment_id`)。
- [x] 2.2 `CommentResponse`（class extends `BaseResponse`）：`snake_case` 白名单字段 `id/post_id/user_id/parent_comment_id/content/author_name/author_avatar_url/created_at/updated_at/reply_count`；`WHITELISTED_FIELDS` 静态集合；`from(comment, authorName, authorAvatarUrl, replyCount)` 工厂。
- [x] 2.3 列表 / 回复端点复用 `CommentResponse` 作为 `Page` 项（与 `PostSummary` 同构，继承 `BaseResponse` 携带 `request_id`）；不另建列表 DTO。

## 3. 异常与错误码

- [x] 3.1 `ErrorCode` 新增 `COMMENT_NOT_FOUND(404)`、`NOT_COMMENT_AUTHOR(403)`、`INVALID_PARENT_COMMENT(400)`。
- [x] 3.2 新增 `comments/exception/CommentException.java`（与 `PostException` 同构，持有 `ErrorCode` + `details`）。
- [x] 3.3 `GlobalExceptionHandler` 新增 `handleCommentException` 分支。

## 4. Service 层

- [x] 4.1 `comments/service/CommentService.java`（构造器注入 `CommentRepository` + `PostRepository` + `UserRepository`）：`create(postId, userId, req, now)`（帖不存在→`POST_NOT_FOUND`；回复父评论须同帖且 `parent.isTopLevel()` 否则 `INVALID_PARENT_COMMENT`；保存→`CommentResponse`）、`listTopLevel(postId, page, size, now)`（帖不存在→`POST_NOT_FOUND`；倒序；含 `reply_count`）、`listReplies(commentId, page, size, now)`（父不存在→`COMMENT_NOT_FOUND`；升序）、`delete(commentId, userId, now)`（不存在→`COMMENT_NOT_FOUND`；非作者→`NOT_COMMENT_AUTHOR`；顶层评论级联软删其回复、回复仅自身软删）。`size` 钳制 50。
- [x] 4.2 作者解析私有方法（批量 IN，复用 `UserRepository.findAllById`，缺失/已删回退 `[unknown user]` 占位），与 `PostService.resolveAuthors` 同构。

## 5. Controller 层

- [x] 5.1 `comments/api/CommentsController.java`：`POST /api/posts/{postId}/comments`（需鉴权，`currentUserId()`）、`GET /api/posts/{postId}/comments`（需鉴权）、`GET /api/comments/{commentId}/replies`（需鉴权）、`DELETE /api/comments/{commentId}`（需鉴权 + 作者校验）。`currentUserId()` 与 `PostsController` 同构，未认证抛 `CommentException(UNAUTHENTICATED)`。

## 6. 测试（TDD，全绿）

- [x] 6.1 实体/仓库测试：`Comment` 落库；`AndDeletedFalse` 过滤生效；`countByParentCommentIdAndDeletedFalse` 正确；`findAllByParentCommentIdAndDeletedFalse` 级联加载。
- [x] 6.2 Service 单测：发布顶层/回复成功；回复父评论跨帖→`INVALID_PARENT_COMMENT`；回复嵌套在回复之下→`INVALID_PARENT_COMMENT`；帖不存在→`POST_NOT_FOUND`；列表仅顶层、`replyCount` 正确；作者缺失回退占位；删除顶层评论级联软删其回复、删除回复不影响兄弟。
- [x] 6.3 Controller `@SpringBootTest` 切片：覆盖 `201` 创建、`401`（无令牌）、`404` 帖不存在、`400` 跨帖或嵌套父评论、`403` 非作者删、`404` 评论不存在、列表/回复分页、级联删除后父与回复均不可达。
- [x] 6.4 安全边界测试：响应 JSON 不含 `deleted_at` / 作者 `email`。

## 7. API 契约与收尾

- [ ] 7.1 controller 加 springdoc 注解（已完成）；重新生成 `/v3/api-docs` 并更新前端 `openapi.json`（`npm run openapi:sync`）— 该刷新属前端契约快照，建议并入「前端消费评论接口」change 统一处理。
- [ ] 7.2 后端 `mvn` 编译 + 全量测试绿灯（已通过；唯一全量失败为 `PostsControllerIntegrationTest.fullFlowCreatePublishListDetail`，属共享 MySQL 测试库预先存在的已发布帖子脏数据，与本 change 无关，见 review 说明）；`openapi:drift` 通过（需起后端 + 前端，随前端 change 执行）。
