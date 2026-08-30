## 1. 数据模型与仓库

- [x] 1.1 `bookmarks/domain/Bookmark.java`：继承 `BaseEntity`；`@Table(uniqueConstraints=@UniqueConstraint(name="uk_bookmarks_post_user", columnNames={"post_id","user_id"}))`；字段 `postId`(UUID, nullable=false)、`userId`(UUID, nullable=false)；工厂 `Bookmark.create(postId, userId, now)`；**不声明 `@SQLRestriction`**。取消收藏走物理删除（释放唯一约束槽位）。
- [x] 1.2 `bookmarks/repository/BookmarkRepository.java`：`findByUserIdOrderByCreatedAtDesc(userId, Pageable)`、`findByPostIdAndUserId(postId, userId)`。

## 2. DTO

- [x] 2.1 `BookmarkResponse`（extends `BaseResponse`）：`post_id`、`bookmarked`(boolean)；`WHITELISTED_FIELDS` + 序列化测试。
- [x] 2.2 `BookmarkSummary`（列表项，plain DTO 不含 request_id）：`post_id`、`available`(boolean)、`post`(`PostSummary`, 可 null)；snake_case；`WHITELISTED_FIELDS` + 序列化测试（`post` 仅 `available=true` 时非 null）。

## 3. 异常与错误码

- [x] 3.1 复用既有 `ErrorCode`（`UNAUTHENTICATED`/`POST_NOT_FOUND`），不新增枚举。
- [x] 3.2 `bookmarks/exception/BookmarkException.java`（与 `PostException` 同构）。
- [x] 3.3 `GlobalExceptionHandler` 新增 `handleBookmarkException` 分支。

## 4. Service 层

- [x] 4.1 `bookmarks/service/BookmarkService.java`（注入 `BookmarkRepository` + `PostRepository` + `UserRepository`）：`toggle(postId, userId, now)`（帖不存在→`POST_NOT_FOUND`；`@Transactional`；已收藏→`delete`+`bookmarked=false`，未收藏→`create`+`bookmarked=true`）；`listBookmarks(userId, page, size, now)`（全量返回：逐项 `findAllById` 加载帖子→命中且 `!deleted && PUBLISHED` 则 `available=true` 并批量 IN 解析作者后 `PostSummary.from`+`MarkdownSummary.derive`，否则 `available=false`/`post=null`；**不跳过任何 bookmark 行**）。`size` 钳制 50。

## 5. Controller 层

- [x] 5.1 `bookmarks/api/BookmarksController.java`：`POST /api/posts/{postId}/bookmark`（需鉴权，`currentUserId()`）、`GET /api/bookmarks`（需鉴权）。

## 6. 测试（TDD，全绿）

- [x] 6.1 实体/仓储测试：落库；一人一帖唯一约束；按收藏时间倒序。
- [x] 6.2 Service 单测：首次收藏→`bookmarked=true`、再调→取消 `false`、帖不存在→`POST_NOT_FOUND`、列表含全部收藏（失效项 `available=false`/`post=null`）、作者缺失回退。
- [x] 6.3 Controller `@SpringBootTest`：`200` 切换、`401` 无令牌、`404` 帖不存在、列表鉴权、列表含失效占位（`available=false`/`post=null`）、分页钳制、无敏感字段。
- [x] 6.4 安全边界：响应不含 `deleted_at` / 作者 `email`。

## 7. API 契约与收尾

- [ ] 7.1 controller 加 springdoc 注解（已完成）；重新生成 `/v3/api-docs` 并更新前端 `openapi.json`（`npm run openapi:sync`）— 属前端契约快照，建议并入「前端消费收藏接口」change 统一处理。
- [ ] 7.2 后端 `mvn` 编译 + 全量测试绿灯（已通过；唯一全量失败为 `PostsControllerIntegrationTest.fullFlowCreatePublishListDetail`，属共享 MySQL 测试库预先存在的已发布帖子脏数据，与本 change 无关）；`openapi:drift` 通过（需起后端 + 前端，随前端 change 执行）。
