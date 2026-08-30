## Why

帖子详情页与「我的收藏」页需要收藏能力。当前 `posts` capability 不含收藏数据。引入 `post-bookmarks` capability，以「一人一帖一收藏（post_id, user_id 唯一）」模型支撑收藏切换与「我的收藏」列表，列表直接复用 `PostSummary` 呈现被收藏帖子。

## What Changes

- 新增 `post-bookmarks` capability，HTTP 接口位于 `/api/posts/{postId}/bookmark` 与 `/api/bookmarks`：
  - `POST /api/posts/{postId}/bookmark` — 鉴权。toggle 语义：不存在→收藏（创建），已存在→取消（删除）。返回 `{ post_id, bookmarked }`（当前是否已收藏）。
  - `GET /api/bookmarks?page=&size=` — 鉴权。返回当前用户**全部**收藏项分页（`Page<BookmarkSummary>`），含已失效帖子的 `available=false` 占位（不再静默跳过），按收藏时间倒序。
- 新增 JPA 实体 `Bookmark`（继承 `BaseEntity`）：`postId`(UUID)、`userId`(UUID)。`@Table(uniqueConstraints = @UniqueConstraint(name="uk_bookmarks_post_user", columnNames={"post_id","user_id"}))` 防重复。
- **取消收藏 = 物理删除行**（同 votes，保留唯一约束有效；`deleted` 列恒 false；仍 `extends BaseEntity`）。
- 列表复用 `posts.api.PostSummary`（`from(Post, authorName, authorAvatarUrl, summary)`）与 `MarkdownSummary.derive` 公共静态，作者解析在 bookmarks service 内批量 IN（`UserRepository`）实现（自包含，不修改 `posts` 行为）。

无 **BREAKING** 变更（仅新增端点与数据表 `bookmarks`）。

## Capabilities

### New Capabilities

- `post-bookmarks`：帖子的收藏 / 取消切换与「我的收藏」分页列表。

### Modified Capabilities

- `auth-module`（仅扩展）：`GlobalExceptionHandler` 新增 `BookmarkException` 映射（复用既有 `UNAUTHENTICATED`/`VALIDATION_FAILED`/`POST_NOT_FOUND`，无需新增枚举）。

## Impact

- 新增数据表 `bookmarks`（唯一约束 `uk_bookmarks_post_user`）；新增后端包 `com.mooc.backend.bookmarks`（api / domain / repository / service / exception）。
- 依赖 `auth`（`User` 作者解析）、`common.BaseEntity`、`posts`（`postRepository.findByIdAndDeletedFalse` 校验帖存在 + 只读复用 `PostSummary`/`MarkdownSummary` 公共静态，不改动 posts 模块行为）。
- 鉴权：两个端点均需 JWT，`userId` 由令牌主体推导。
- API 契约：`/v3/api-docs` 重新生成并更新前端 `openapi.json`（前端「我的收藏」页后续 change 消费）。
- 通知：被收藏通知不在本 change（独立 `notifications` change）。
- 限流：本 change **不**接入限流（收藏操作频率低，风险小；与评论/投票区分）。
