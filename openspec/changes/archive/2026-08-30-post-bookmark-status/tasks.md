## 1. DTO（先写失败测试）

- [ ] 1.1 新增 `BookmarkStatusResponse extends BaseResponse`（`post_id` / `bookmarked`，snake_case 白名单 + `WHITELISTED_FIELDS`）。
- [ ] 1.2 新增 `BookmarkStatusResponseSerializationTest`：仅输出 `post_id` / `bookmarked` / `request_id` 三字段，不泄漏 `user_id`。

## 2. Service（TDD）

- [ ] 2.1 `BookmarkService.isBookmarked(postId, userId)`：已收藏 → `true`；未收藏 → `false`。
- [ ] 2.2 单测：帖子不存在 → 抛 `BookmarkException(ErrorCode.POST_NOT_FOUND)`。
- [ ] 2.3 单测：复用 `findByPostIdAndUserId(...).isPresent()` 判定（不新增 repository 方法）。

## 3. Controller（TDD）

- [ ] 3.1 `BookmarksController` 新增 `GET /api/posts/{postId}/bookmark` 映射，调用 `isBookmarked`。
- [ ] 3.2 集成测试：已认证已收藏 → 200 `bookmarked=true`；已认证未收藏 → 200 `bookmarked=false`；未认证 → 401 `UNAUTHENTICATED`；帖子不存在 → 404 `POST_NOT_FOUND`。

## 4. 收尾

- [ ] 4.1 `mvn test` 全绿（bookmarks 模块）。
- [ ] 4.2 重生成 `/v3/api-docs`；前端 `npm run openapi:sync` 刷新快照（供 `post-detail-engagement` 消费）。
- [ ] 4.3 归档本 change。
