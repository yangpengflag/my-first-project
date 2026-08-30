## Context

- `post-bookmarks` capability 已交付：实体 `Bookmark`（继承 `BaseEntity`，`post_id`/`user_id`，唯一约束 `uk_bookmarks_post_user`），取消收藏走**物理删除**（`BookmarkService.toggle` 中 `bookmarkRepository.delete(existing)`）。
- 既有端点：`POST /api/posts/{postId}/bookmark`（toggle）、`GET /api/bookmarks`（列表）。`BookmarksController.currentUserId()` 从 `SecurityContextHolder` 取 UUID 主体，未认证抛 `BookmarkException(ErrorCode.UNAUTHENTICATED)`。
- DTO 约定：单资源响应继承 `com.mooc.backend.dto.response.BaseResponse`（自带 `request_id`），字段 `@JsonProperty("snake_case")` + `WHITELISTED_FIELDS` 静态集合 + 序列化测试守护（见 `BookmarkResponse`）。
- 动机与范围见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 提供只读状态端点 `GET /api/posts/{postId}/bookmark`，精确返回当前用户是否已收藏本帖。
- 严格 snake_case 白名单 + 序列化测试守护，不泄漏多余字段。

**Non-Goals:**
- 不做「批量状态查询」（仅单帖）。
- 不改动 toggle / list 既有行为。
- 不新增错误码（复用 `POST_NOT_FOUND` / `UNAUTHENTICATED`）。

## Decisions

### D1. 端点与鉴权
`GET /api/posts/{postId}/bookmark`，与现有 `POST` toggle 同路径不同 verb（Spring `@GetMapping` / `@PostMapping` 可共存）。`currentUserId()` 复用既有（未认证抛 `UNAUTHENTICATED`）。

### D2. 业务逻辑
`BookmarkService.isBookmarked(postId, userId)`：
1. `postRepository.findByIdAndDeletedFalse(postId).isEmpty()` → 抛 `BookmarkException(ErrorCode.POST_NOT_FOUND)`（与 toggle 一致，统一「帖子不存在」语义）。
2. `bookmarkRepository.findByPostIdAndUserId(postId, userId).isPresent()` 作为 `bookmarked`（物理删除语义下「存在即已收藏」）。

### D3. 响应 DTO
`BookmarkStatusResponse extends BaseResponse`：
- 字段：`post_id`(UUID)、`bookmarked`(boolean)。
- `@JsonInclude(JsonInclude.Include.ALWAYS)`，`WHITELISTED_FIELDS = Set.of("post_id", "bookmarked", "request_id")`。
- 序列化测试守护：仅输出白名单三字段，绝不泄漏 `user_id` 等其他字段。

### D4. API 契约
controller 加 springdoc 注解；实现后重生成 `/v3/api-docs`，前端 `openapi:sync` 刷新快照。

## Risks / Trade-offs

- **[极小风险]** 纯只读查询，无写副作用；复用既有 repository 方法，不引入新表 / 新约束 / 新错误码。
- **[一致性]** 与 toggle 共用「帖子不存在 → POST_NOT_FOUND」，前端可统一错误处理。
