## Context

- 后端三 capability 已交付并通过测试；响应 DTO 为 snake_case + 顶层 `request_id`（`BaseResponse` 风格），错误统一信封 `{error:{code,message,details}}`，由 `createAuthClient` 解析为 `AuthApiError`（见 `lib/auth/client.ts`）。新错误码 `COMMENT_NOT_FOUND` / `INVALID_PARENT_COMMENT` 后端已定义，但前端 `ErrorCode` 联合尚未纳入。
- 前端 `lib/posts/api.ts` 展示薄封装范式：`get/post` 封装 `fetchFromBackend<T>`；`fetchFromBackend` 负责 Bearer 注入、401 静默续期重放、空响应体处理。
- 详情页为 Server Component 外壳（`app/posts/[id]/page.tsx`）+ 客户端子组件 `PostDetail`（四态：loading / content / notfound / error）。
- 会话：`useAuthSession()` 提供 `user / status / logout`；未登录态由 `AuthGuard` 包裹受保护页面时重定向到 `/login?redirect=...`。

## Goals / Non-Goals

**Goals:**
- 详情页接入评论区、投票、收藏三套互动 UI，四态、鉴权门禁、错误文案、可访问性均达标。
- 严格 TDD（RED → GREEN → REFACTOR），先写失败测试。
- 契约刷新走官方 `openapi:sync` / `openapi:gen`，不手改生成物。

**Non-Goals:**
- 不做互动通知（独立 `notifications` change）。
- 不做评论编辑 / 富文本 / 排序切换 / 按作者筛选。
- 不改动后端；不引入新状态管理库（本 change 用组件局部 state + 既有 session）。

## Decisions

### D1. 契约刷新前置
先启动后端（:8080），`npm run openapi:sync` 拉取三 capability 端点 → `openapi.json`；再 `npm run openapi:gen` 重生成 `api.generated.ts`；随后补 `ErrorCode` 联合（`COMMENT_NOT_FOUND` / `INVALID_PARENT_COMMENT`）。验证链：`type-check` → `test` → `build` → `openapi:drift`（需后端运行，比对一致性）。

### D2. 模块拆分与类型派生
每 capability 独立 `lib/<domain>/{api.ts, types.ts, messages.ts}`。`types.ts` 由 `api.generated` 派生（同 `lib/posts/types.ts` 的 `Omit` + 收紧模式）：
- comments：`CommentResponse`、`CommentSummary`、`CreateCommentRequest`、`PageCommentResponse`、`PageReplyResponse`；`CommentErrorCode` 子集。
- votes：`VoteResponse`、`VoteStatsResponse`、`VoteType`（联合 `"UP" | "DOWN"`）。
- bookmarks：`BookmarkResponse`、`BookmarkSummary`、`PageBookmarkSummary`。

### D3. 详情页组合与四态
`PostDetail` 在 `<article>` 之后、`space-y-8` 容器内渲染：
- `<VotePanel postId={id} />`：挂载时 `GET /api/posts/{id}/vote/stats` 初始化（up / down / user_vote）；两个按钮（`ThumbsUp` / `ThumbsDown`，lucide）调用 `POST /api/posts/{id}/vote`；三态（未投 / UP / DOWN）视觉态；counts 显示；需登录。
- `<CommentSection postId={id} />`：`GET /api/posts/{id}/comments` 顶层分页（含 `reply_count`）；展开某评论 `GET /api/comments/{commentId}/replies`（升序）；发布顶层评论表单；每条评论「回复」展开对**该顶层评论**的回复表单（两层模型，`parent_comment_id` 指顶层评论）；作者信息复用响应字段；软删评论响应层显示占位「评论已删除」；登录后可见，未登录显示 gate 提示。
- `<BookmarkButton postId={id} />`：挂载时 `GET /api/posts/{id}/bookmark`（后端 `post-bookmark-status` change 新增）精确获取初始 `bookmarked`；点击 `POST /api/posts/{id}/bookmark` 切换并用返回 `bookmarked` 刷新图标态；需登录。

### D4. 鉴权门禁
三组件均用 `useAuthSession()`。若 `status !== "authenticated"`：
- 投票 / 收藏按钮可点击但点击 → `router.push('/login?redirect=/posts/' + id)`（与 `AuthGuard` 回跳一致）。
- 评论区显示空态卡片「登录后参与讨论」+「去登录」链接（同回跳）。
- 提交若返回 401（会话过期）：`createAuthClient` 清令牌并触发 `AuthGuard` 后续重定向；UI 也可捕获 `AuthApiError`（`UNAUTHENTICATED`）提示「请重新登录」。

### D5. 错误处理与文案
各 domain `messages.ts` 映射 `AuthApiError.code` → 中文文案，复用 `describePostError` 模式（`VALIDATION_FAILED` 可能带 `details` 字段错误）。`RATE_LIMITED` → 「操作过于频繁，请稍后再试」；`COMMENT_NOT_FOUND` → 「评论不存在或已删除，请刷新」；`INVALID_PARENT_COMMENT` → 「回复对象无效」。

### D6. 更新模型（首版）
首版采用「请求完成后更新 UI」的简单模型（非乐观更新），保证正确性：
- 投票：stats 返回后渲染；点击 toggle 后用响应 `user_vote` / counts 刷新。
- 评论：发布成功后把新评论插入列表（顶层插到首部或尾部视排序而定）；删除成功后本地移除或置占位。
- 收藏：toggle 后用返回 `bookmarked` 刷新图标态。
乐观更新列为后续优化项。

### D7. 样式与无障碍
- 按钮：`Button`（shadcn）；投票激活态 `text-blue-700` / `bg-blue-50`；收藏激活 `BookmarkCheck`。
- 加载：`Skeleton`（与 `PostDetail` 一致）。
- 空态：居中图标（`MessageSquare` / `Bookmark` / `ThumbsUp`）+ 引导文案。
- 错误态：`Alert` + 重试。
- 图标按钮带 `aria-label`；表单 `Label` + 必填 `*`；提交中 `Loader2` 旋转 + disabled。

## Risks / Trade-offs

- **[初始收藏态]** 由后端新增的 `GET /api/posts/{id}/bookmark` 精确返回，无分页误差（依赖 `post-bookmark-status` change 先行合并）。
- **[评论分页放大]** 参考后端 risk；前端仅渲染首屏 + 「加载更多」。
- **[改动 api.generated]** 严禁手改，统一由 `openapi:gen` 生成；刷新契约后须重跑 `openapi:drift`。
- **[契约漂移]** 若后端未同步即生成会导致编译失败——任务顺序保证先 sync 再 gen 再 type-check。
- **[评论区需登录]** 已与后端决策一致（读端点均需 JWT）；未登录展示 gate 而非内容。
