## Why

前端详情页收藏按钮需要可靠地获取「当前用户是否已收藏本帖」的初始态。原方案（拉 `/api/bookmarks` 列表 size=50 推断）对收藏数 >50 的用户会误判。补一个轻量只读端点 `GET /api/posts/{postId}/bookmark` 返回 `{post_id, bookmarked}`，由后端精确判定，消除分页误差。

## What Changes

- 新增 `GET /api/posts/{postId}/bookmark`（需 JWT）：返回 `BookmarkStatusResponse { post_id, bookmarked }`。
- `BookmarkService.isBookmarked(postId, userId)`：复用 `BookmarkRepository.findByPostIdAndUserId(...).isPresent()`（取消收藏走物理删除，故「存在即已收藏」）。
- 帖子不存在 → `404 POST_NOT_FOUND`；未认证 → `401 UNAUTHENTICATED`（与现有 toggle 端点同构）。
- 新增 DTO `BookmarkStatusResponse extends BaseResponse`，snake_case 白名单 + 序列化测试守护。

无 **BREAKING** 变更（仅新增只读端点，不改动既有 toggle / list 行为）。

## Capabilities

### New Capabilities

- 无（在 `post-bookmarks` capability 内扩展一个读取端点）。

### Modified Capabilities

- `post-bookmarks`：新增 `GET /api/posts/{postId}/bookmark` 状态查询端点。
- `auth-module`（仅复用）：错误码复用既有 `POST_NOT_FOUND` / `UNAUTHENTICATED`，无新增。

## Impact

- 改动 `bookmarks` 包：`BookmarksController`（新增 GET 映射）、`BookmarkService`（新增 `isBookmarked`）、新增 `BookmarkStatusResponse`；`BookmarkRepository` 复用既有 `findByPostIdAndUserId`（不新增方法）。
- 前端 `post-detail-engagement` 的 `BookmarkButton` 改用此端点替代 size=50 列表推断。
- 测试：`BookmarkStatusResponse` 序列化测试、`BookmarkService.isBookmarked` 单测、`BookmarksController` 集成测试（200 / 401 / 404）。
- API 契约：实现后重生成 `/v3/api-docs`，前端 `openapi:sync` 刷新快照供 `post-detail-engagement` 消费。
