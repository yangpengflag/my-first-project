## Why

`posts` capability 的后端 API 已就绪（列表 / 创建 / 详情，公开 + 需鉴权），但前端尚无任何消费页面：用户既无法浏览与阅读攻略，也无法创作。首页 `hot-posts` 区块（见 `docs/homepage/homepage-hot-posts.md`）也依赖这些页面作为落地承接。本 change 在 `frontend` submodule 内实现三页——公开列表、需登录的创建页、公开详情页——消费既有 `/api/posts` 契约，并补齐前端侧的 Markdown 编辑、渲染净化、标签输入与四态覆盖。

## What Changes

- 新增路由组 `app/(posts)/`：列表 `page.tsx`、创建 `create/page.tsx`（由 `<AuthGuard>` 包裹）、详情 `[id]/page.tsx`。
- 新增 API 封装层 `lib/posts/api.ts`（复用 `fetchFromBackend<T>`）、`lib/posts/types.ts`（派生自 `api.generated.ts`）、`lib/posts/messages.ts`（错误文案映射）。
- 新增组件：`_components/PostList.tsx`（四态状态机）、`PostCard.tsx`、`PostEditor.tsx`（基于 `@uiw/react-md-editor` 带工具栏）、`TagInput.tsx`、`PostDetail.tsx`、Markdown 渲染器（`react-markdown` + `rehype-sanitize`）。
- 新增依赖（兼容 React 18）：`@uiw/react-md-editor`、`react-markdown`、`rehype-sanitize`。
- 三页均覆盖四态（Loading / Content / Empty / Error）；详情页以白名单净化渲染 Markdown（防 XSS，呼应 spec「渲染 / 净化由前端负责」）。

无 **BREAKING** 变更（仅新增前端页面与依赖，不动后端契约；`api.generated.ts` 中 posts 端点快照已存在）。

## Capabilities

### New Capabilities

- 无（沿用既有 `posts` capability）。

### Modified Capabilities

- `posts`：新增前端消费页面——公开列表、需登录创建、公开详情，以及配套编辑 / 渲染 / 标签输入能力。

## Impact

- `frontend` submodule：新增路由、组件、API 封装与三个依赖；需 `npm install` 并跑 `type-check` / `test` / `build`。
- 依赖既有 `lib/backend.ts` 的 `fetchFromBackend<T>` 与 `lib/auth` 的 `AuthGuard` / `useAuthSession`。
- 不改 `api.generated.ts`（posts 端点已存在于 openapi 快照）。
- 不改后端代码；本 change 仅触及 `frontend/` 子仓与父仓 submodule 指针。
