## Why

帖子详情页（前端后续 change 负责 UI）需要评论与回复能力。当前系统已有 `posts` capability（发布 / 列表 / 详情），但没有任何围绕帖子的互动数据：无法评论、无法回复、无法查看某帖的评论区。引入 `post-comments` capability，以树形（两层：顶层评论 + 其回复）模型支撑帖子详情页的评论区，作者展示信息复用既有 `User` 身份，软删除与 `posts` 保持同一约定（仓储层 `AndDeletedFalse` 显式过滤，非 `@SQLRestriction`）。

## What Changes

- 新增 `post-comments` capability，HTTP 接口位于 `/api/posts/{postId}/comments` 与 `/api/comments/{commentId}/replies`：
  - `POST /api/posts/{postId}/comments` — 鉴权。body `{ content, parent_comment_id? }`；`parent_comment_id` 为空 → 顶层评论，否则 → 对该评论的回复（须属同一帖子，否则 400）。
  - `GET /api/posts/{postId}/comments?page=&size=` — 鉴权（需 JWT）。返回顶层评论分页，每项含 `reply_count` 与作者展示信息。
  - `GET /api/comments/{commentId}/replies?page=&size=` — 鉴权（需 JWT）。返回该评论的回复分页（按创建时间升序）。
  - `DELETE /api/comments/{commentId}` — 鉴权，仅作者本人。软删除，204；非作者 403；不存在/已删 404。
- 新增 JPA 实体 `Comment`（继承 `BaseEntity`）：`postId`(UUID)、`userId`(UUID)、`content`(TEXT)、`parentCommentId`(UUID, 可空，自引用)。
- 软删除沿用 `posts` 约定：仓储层 `findByXxxAndDeletedFalse` 显式过滤；**不**在实体类加 `@SQLRestriction`。父评论软删后，其回复保留，父评论内容在出网时替换为占位文案「评论已删除」。
- 白名单响应 DTO（`CommentResponse` / `CommentSummary`）：snake_case + 继承 `BaseResponse`（自带 `request_id`）；不输出 `deleted_at`、不泄露作者 `email`。

> 注：全部端点（含评论列表 / 回复查询）均需 JWT 认证，与"全部需要JWT认证"一致；帖子详情页的评论区将要求登录后可见。`currentUserId()` 在列表/回复端点仅作鉴权闸门（响应本身不含当前用户态）。

无 **BREAKING** 变更（仅新增端点与数据表 `comments`）。

## Capabilities

### New Capabilities

- `post-comments`：帖子评论与回复的发布、分页查询、软删除；两层（顶层 + 回复）树形结构；作者展示信息复用 `User`。

### Modified Capabilities

- `auth-module`（仅扩展）：`GlobalExceptionHandler` 新增 `CommentException` 映射；`ErrorCode` 新增 `COMMENT_NOT_FOUND` / `NOT_COMMENT_AUTHOR` / `INVALID_PARENT_COMMENT`。

## Impact

- 新增数据表 `comments`；新增后端包 `com.mooc.backend.comments`（api / domain / repository / service / exception）。
- 依赖 `auth`（`User` 只读解析作者展示信息）、`common.BaseEntity` 内核、`posts`（`postRepository.findByIdAndDeletedFalse` 校验帖子存在性，复用 `ErrorCode.POST_NOT_FOUND`）。
- 鉴权：全部端点需 JWT，`userId` 由令牌主体推导（`currentUserId()`，同 `PostsController`）；未认证返回 `401 UNAUTHENTICATED`。列表 / 回复查询同样需 JWT（不再公开）。
- API 契约：`/v3/api-docs` 将重新生成并更新前端 `openapi.json` 进仓快照；前端帖子详情页（后续 change）消费。
- 通知：被评论 / 被回复的互动通知**不在本 change 范围**，由独立的 `notifications` change 接入（本 change 不预留 hook，保持聚焦）。
