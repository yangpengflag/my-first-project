## Context

- 同 `post-comments`/`post-votes`：Spring Boot 3.5 / Java 17 / 标准分层；`BaseEntity` 软删约定（仓储层 `AndDeletedFalse`）；响应 DTO 约定（BaseResponse + snake_case + WHITELISTED_FIELDS + 序列化测试）；JWT 主体即用户；统一错误信封。
- `posts.api.PostSummary.from(...)` 与 `posts.MarkdownSummary.derive(...)` 为公共静态，可被 bookmarks service 直接调用以构建列表项（只读复用，不修改 posts）。
- 动机与范围见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 实现 `toggle(postId, userId)`（收藏/取消）与 `listBookmarks(userId, page)`（返回 `Page<PostSummary>`）。
- 一人一帖唯一：`@Table` 唯一约束 `(post_id, user_id)`。
- 取消 = 物理删除；`Bookmark` 仍 `extends BaseEntity`。

**Non-Goals:**
- 不做收藏文件夹 / 分类。
- 不做收藏时间线 / 按标签筛选。
- 不做互动通知（独立 change）。
- 不做公开「某用户的收藏」列表（仅本人可见）。

## Decisions

### D1. 包与分层
`com.mooc.backend.bookmarks`：`api/`（`BookmarksController`、`BookmarkResponse`）、`domain/`（`Bookmark`）、`repository/`（`BookmarkRepository`）、`service/`（`BookmarkService`）、`exception/`（`BookmarkException`）。

### D2. 实体与唯一约束
`Bookmark extends BaseEntity`；`postId`、`userId`；`@Table(uniqueConstraints=@UniqueConstraint(name="uk_bookmarks_post_user", columnNames={"post_id","user_id"}))`。取消收藏走 `repository.delete`（物理删），`deleted` 恒 false。不声明 `@SQLRestriction`。

### D3. toggle() 语义
`BookmarkService.toggle(postId, userId, now)`：
1. `postRepository.findByIdAndDeletedFalse(postId)` 不存在 → `POST_NOT_FOUND`。
2. `bookmarkRepository.findByPostIdAndUserId(postId, userId)`：
   - 空 → 新建 `Bookmark` 保存，结果 `bookmarked=true`。
   - 存在 → `repository.delete(existing)`，结果 `bookmarked=false`。
3. 返回 `BookmarkResponse { post_id, bookmarked }`。

### D4. listBookmarks(userId, page, size, now)
`BookmarkService.listBookmarks(userId, page, size, now)`：
- `Pageable` 按 `createdAt` 倒序（最近收藏在前），`size` 钳制 50。
- `bookmarkRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)` → `Page<Bookmark>`（以 bookmark 分页总数为 `total`，**不跳过任何项**，避免分页空档）。
- 对每个 bookmark 的 `postId`，`postRepository.findByIdAndDeletedFalse` 加载帖子：
  - 命中且 `status == PUBLISHED` → `available = true`，收集 `postId` 批量 IN 解析作者后调 `PostSummary.from(post, name, avatar, MarkdownSummary.derive(content))`。
  - 未命中 / 已软删 / 非 PUBLISHED → `available = false`，`post = null`。
- 构建 `BookmarkSummary { post_id, available, post }` 列表项（`post` 仅当 `available` 时非 null）。
- 返回 `PageImpl<BookmarkSummary>`。前端据 `available` 渲染「帖子已不可用」占位（不再静默丢弃用户已收藏的内容）。

### D5. 并发与唯一约束
同 votes：高并发 toggle 可能撞唯一约束。仅「收藏」分支有 INSERT 风险；`@Transactional` + 捕获 `DataIntegrityViolationException` → 重读确认已存在、返回 `bookmarked=true` 兜底。

### D6. DTO 与校验
- `BookmarkResponse`（extends `BaseResponse`）：`post_id`、`bookmarked`(boolean)。`WHITELISTED_FIELDS` + 序列化测试。
- 列表端点返回 `Page<BookmarkSummary>`（列表项，不带 `request_id`，同 `PostsController.list`）：`BookmarkSummary`（`post_id`、`available`(boolean)、`post`(`PostSummary`, 可 null)；snake_case；`WHITELISTED_FIELDS` + 序列化测试）。`post` 仅当 `available=true` 时非 null。
- `PostSummary` / `MarkdownSummary` 只读复用（posts 既有公共静态），其 `WHITELISTED_FIELDS` 已保证无 `email`/`deleted_at`。

### D7. 鉴权与错误码
- `BookmarksController.currentUserId()` 同 `PostsController`；未认证抛 `BookmarkException(ErrorCode.UNAUTHENTICATED)`。
- 复用既有 `ErrorCode`：`UNAUTHENTICATED`(401)、`POST_NOT_FOUND`(404)、`VALIDATION_FAILED`(400)。**无需新增枚举**。
- `GlobalExceptionHandler` 新增 `handleBookmarkException` 分支。

### D8. Schema 供给
`bookmarks` 表 + 唯一约束；沿用现有供给机制。

### D9. API 契约
springdoc 注解 + 重新生成 `/v3/api-docs` + 更新前端 `openapi.json`。

## Risks / Trade-offs

- **[物理删除与审计]** → 收藏取消无需审计，物理删合理。
- **[失效帖子展示]** → 不再静默跳过；失效收藏以 `available=false` + `post=null` 呈现，前端渲染占位，分页不再出现空档（见 D4）。
- **[并发撞唯一约束]** → D5 兜底。
- **[复用 posts DTO 的耦合]** → 仅调用公共静态（`PostSummary.from`/`MarkdownSummary.derive`），只读、无 posts 行为变更，archive 零冲突。
