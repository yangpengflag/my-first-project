## 0. 契约刷新（前置，TDD 前必须完成）

- [ ] 0.1 启动后端（:8080），`npm run openapi:sync` 更新 `frontend/openapi/openapi.json`（含 comments / votes / bookmarks 端点）。
- [ ] 0.2 `npm run openapi:gen` 重生成 `lib/api.generated.ts`。
- [ ] 0.3 `lib/auth/types.ts` 的 `ErrorCode` 联合补 `COMMENT_NOT_FOUND` / `INVALID_PARENT_COMMENT`。
- [ ] 0.4 `npm run type-check` 通过（新类型可用，无红）。

## 1. API 模块（先类型与文案，再封装）

- [ ] 1.1 `lib/comments/types.ts`：派生 `CommentResponse` / `CommentSummary` / `CreateCommentRequest` / `PageCommentResponse` / `PageReplyResponse` + `CommentErrorCode`。
- [ ] 1.2 `lib/comments/messages.ts`：`describeCommentError(error)`（映射 `AuthApiError.code`）。
- [ ] 1.3 `lib/comments/api.ts`：`list(postId, page, size)`、`replies(commentId, page, size)`、`create(postId, body)`、`remove(commentId)`。
- [ ] 1.4 `lib/votes/types.ts`：派生 `VoteResponse` / `VoteStatsResponse` / `VoteType`，`VoteException` 文案映射（复用 `describePostError` 或新建）。
- [ ] 1.5 `lib/votes/api.ts`：`stats(postId)`、`vote(postId, voteType)`。
- [ ] 1.6 `lib/bookmarks/types.ts`：派生 `BookmarkResponse` / `BookmarkSummary` / `PageBookmarkSummary`。
- [ ] 1.7 `lib/bookmarks/api.ts`：`list(page, size)`、`toggle(postId)`。
- [ ] 1.8 类型派生单测（各 `types.test.ts`，确认字段收紧正确）。

## 2. VotePanel（TDD：先失败测试）

- [ ] 2.1 挂载取 stats → loading / content / error 三态；先写失败测试再实现。
- [ ] 2.2 三态切换（UP / DOWN / 取消），用响应 `user_vote` / counts 刷新。
- [ ] 2.3 鉴权门禁：未登录点击 → `router.push('/login?redirect=/posts/'+id)`。
- [ ] 2.4 样式 + 无障碍（`aria-label`、激活态 `text-blue-700` / `bg-blue-50`）。

## 3. CommentSection（TDD）

- [ ] 3.1 顶层列表 loading / content / empty + 「加载更多」分页。
- [ ] 3.2 发布顶层评论表单：提交中 `Loader2` + disabled，成功后插入列表。
- [ ] 3.3 两层回复：展开回复列表（升序）+ 回复表单（`parent_comment_id` 指顶层评论）。
- [ ] 3.4 软删占位（「评论已删除」）+ 作者删除按钮（403 / 404 处理）。
- [ ] 3.5 鉴权门禁：未登录空态「登录后参与讨论」+「去登录」链接。

## 4. BookmarkButton（TDD）

- [ ] 4.1 挂载 `GET /api/posts/{id}/bookmark`（依赖后端 `post-bookmark-status` change）获取初始 `bookmarked`。
- [ ] 4.2 点击 `POST /api/posts/{id}/bookmark` 切换 + 刷新图标态；需登录门禁。
- [ ] 4.3 样式（`Bookmark` / `BookmarkCheck` 图标）。

## 5. 详情页组合

- [ ] 5.1 `PostDetail.tsx` 在 `<article>` 之后、`space-y-8` 容器内渲染 `VotePanel` / `CommentSection` / `BookmarkButton`，保持间距与 `max-w-3xl`。
- [ ] 5.2 回归 `PostDetail.test.tsx`（正文渲染四态不被破坏）。

## 6. 收尾

- [ ] 6.1 `npm run test` 全绿；`npm run build` 通过；`npm run openapi:drift`（后端运行）通过。
- [ ] 6.2 可选 e2e：`frontend/tests/e2e/posts-flow.spec.ts` 补「已登录发布评论并可见」。
- [ ] 6.3 归档本 change（移至 `openspec/changes/archive/`，同步 submodule 指针）。
