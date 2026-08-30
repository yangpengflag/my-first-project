## Why

帖子详情页（前端）当前仅渲染正文，没有任何互动能力。后端已交付 `post-comments` / `post-votes` / `post-bookmarks` 三个 capability（HTTP 接口、错误码、限流均已就绪并通过测试）。本 change 在详情页接入这三类互动 UI——评论区（发布 / 两层回复 / 分页 / 软删占位 / 登录可见）、投票（UP / DOWN 三态）、收藏（切换 + 我的收藏推断初始态）——使详情页成为完整的互动消费方。

## What Changes

- **刷新前端 API 契约快照（前置）**：启动后端（:8080）后 `npm run openapi:sync`（拉取三 capability 端点至 `frontend/openapi/openapi.json`）+ `npm run openapi:gen`（重生成 `lib/api.generated.ts`）；在 `lib/auth/types.ts` 的 `ErrorCode` 联合中补 `COMMENT_NOT_FOUND` / `INVALID_PARENT_COMMENT`（其余 `POST_NOT_FOUND` / `UNAUTHENTICATED` / `RATE_LIMITED` / `VALIDATION_FAILED` 已存在）。
- **新增 domain API 模块**：`lib/comments/{api.ts,types.ts,messages.ts}`、`lib/votes/{...}`、`lib/bookmarks/{...}`，沿用 `lib/posts/api.ts` 的薄封装范式（只描述「调哪个端点、传什么、返回什么」，`fetchFromBackend` 负责传输 / 解析）。
- **详情页组合**：在 `PostDetail.tsx` 的 `<article>` 之后插入三个客户端子组件 `<VotePanel>` / `<CommentSection>` / `<BookmarkButton>`（同目录 `_components/`）。
- **鉴权门禁**：评论区 / 投票 / 收藏均需登录；未登录时引导至 `/login?redirect=/posts/{id}`（复用 `AuthGuard` 回跳约定）。
- **四态覆盖**：每个新区块遵循 loading / content / empty / error（style 规约）。

无 **BREAKING** 变更（仅新增前端模块与组件；不改动既有 `posts` 消费方式，也不改动后端）。

## Capabilities

### New Capabilities

- `post-detail-engagement`：详情页评论区、投票、收藏的前端消费 UI 与对应 API 客户端。

### Modified Capabilities

- `posts`（详情页外壳）：正文下方组合三种互动组件。
- 契约：前端 `openapi.json` 快照刷新（后端无变更，仅前端重新 pull）。

## Impact

- 新增 `lib/comments`、`lib/votes`、`lib/bookmarks` 三套模块；新增 `_components/VotePanel.tsx`、`CommentSection.tsx`、`BookmarkButton.tsx`。
- 依赖后端已交付的三 capability；依赖既有 `useAuthSession`、`AuthGuard`、`components/ui/*`、lucide 图标、Zustand（如需要仅用现有 session）。
- 测试：Vitest + RTL 覆盖各组件四态与鉴权门禁；可选 e2e 补一条「已登录发布评论」流程。
- 样式：严格遵循 style 规约（Tailwind / shadcn / blue-700 / Skeleton / 四态 / 无障碍）。
