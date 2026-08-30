## Approach

### API 封装层

- `lib/posts/types.ts`：从 `api.generated.ts` 派生 `PostResponse` / `PostSummary` / `CreatePostRequest` / `PagePostSummary` / `PostListParams`，并对「成功响应必然包含」的关键字段做收紧（如 `PostSummary.id` / `title` / `status` 标为非可选），使后端契约变更在编译期暴露。
- `lib/posts/api.ts`：导出 `postsApi`，内部统一复用 `fetchFromBackend<T>`（BFF 已处理 Bearer 注入、401 续期重放、统一错误信封与空响应体）：
  - `list(params?: PostListParams): Promise<PagePostSummary>` → `GET /api/posts?page&size`
  - `create(input: CreatePostRequest): Promise<PostResponse>` → `POST /api/posts`（需鉴权，401 由 BFF 处理）
  - `getById(id: string): Promise<PostResponse>` → `GET /api/posts/{id}`
- `lib/posts/messages.ts`：导出 `describePostError`，按 `error.code` 分支映射 `POST_NOT_FOUND` / `NOT_POST_AUTHOR` / `VALIDATION_FAILED` / `UNAUTHENTICATED` / `TOKEN_INVALIDATED` 等，网络异常单独处理（不误判为「未登录」）。

### 路由组与鉴权

- `app/posts/page.tsx`（列表）、`app/posts/[id]/page.tsx`（详情）：Server Component 仅提供页面外壳（标题 / 副标题 / 返回导航）；数据拉取交给 Client 子组件 `useEffect` 调用 `postsApi`（因 `fetchFromBackend` 依赖 localStorage 的 token，仅客户端可用，不能 SSR 直拉）。
- `app/posts/create/page.tsx`：用 `<AuthGuard>` 包裹（未登录 → `router.replace('/login?redirect=...')`，参考 `components/auth/auth-guard.tsx`）；表单本身为 Client Component。

### 列表页

- `_components/PostList.tsx`：状态机 `loading | content | empty | error`；首次拉 `postsApi.list({page:0,size:20})`；卡片用 `PostCard`；分页基于 `PagePostSummary` 元信息（`first`/`last`/`number`/`totalPages`）做上一页 / 下一页（不引入分页器组件，保持简单）。
- `_components/PostCard.tsx`：封面 `aspect-[16/9]` + `bg-cover bg-center`；无图时渐变占位 `bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100` + 居中图标；标题（`text-lg font-semibold`）、`summary`（截断 2 行）、`tags` chip、`author_name` + `author_avatar_url`（圆角头像，`[unknown user]` 回退）、`created_at` 相对时间。整卡 `<Link href={'/posts/'+id}>`。

### 创建页（需登录）

- `_components/PostEditor.tsx`：react-hook-form + zod 校验——`title` 非空且 ≤200；`content` 非空；`tags` ≤10 且每项 `trim` 后 ≤30；`coverImageUrl` 可选、须为 URL。
  - `content` 用 `@uiw/react-md-editor`（带工具栏、支持暗色）；该包含浏览器 API，以 `next/dynamic` `ssr:false` 引入避免 SSR 报错。
  - `coverImageUrl` 用 shadcn `Input`；`tags` 用自建 `TagInput`（回车 / 逗号添加 chip、可删、触顶禁用）。
  - 两个提交动作「保存草稿」「发布」分别传 `status: "DRAFT"` / `"PUBLISHED"`，避免引入 `Select` 组件。
  - 后端 `VALIDATION_FAILED` 的 `details` 映射回对应字段错误（`FormMessage` 展示）；提交中 `Loader2` 旋转 + `disabled`；成功 `router.push('/posts/'+id)`。

### 详情页

- `_components/PostDetail.tsx`：拉 `postsApi.getById(id)`；`POST_NOT_FOUND` → Not Found 态（居中图标 + 引导文案 + 返回列表 CTA）；其余错误 → Error 态（重试）。
- Markdown 渲染器：`react-markdown` + `rehype-sanitize`（白名单净化，剥离 `<script>`/`onerror` 等，防 XSS）；`prose` 排版（`@tailwindcss/typography` 若未装则用基础 utility 类近似，避免新增插件）。
- 封面 `aspect-[16/9]` + 渐变占位兜底；作者展示 `author_name` / `author_avatar_url`（已删作者回退占位）；`created_at` / `updated_at` 本地化格式化；`tags` chip。

### 样式

遵循 styling-conventions：卡片 `shadow-sm border border-slate-200`、四态覆盖、返回导航 `<Link>` + `<ArrowLeft />` + `text-blue-700`、图片渐变占位 + `bg-slate-100` 兜底、响应式 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3/4` 渐进增列、页面背景 `bg-gradient-to-b from-slate-50 to-white`。

## Tests (TDD)

- `lib/posts/api.test.ts`：mock `fetchFromBackend`，覆盖 list/create/getById 成功与错误分支（含 401 / 404 → 抛对应 `AuthApiError`）。
- `PostList.test.tsx`：四态渲染（skeleton / content / empty / error+retry）。
- `PostCard.test.tsx`：无图占位兜底、字段渲染、链接指向正确。
- `TagInput.test.tsx`：添加 / 删除 / 触顶禁用 / 去空格。
- `PostEditor.test.tsx`：zod 校验失败提示、双动作提交、`VALIDATION_FAILED.details` 回填、未登录 `<AuthGuard>` 跳转。
- `PostDetail.test.tsx`：`POST_NOT_FOUND` → Not Found 态；Markdown 净化（`<script>` 被剥离、仅安全标签保留）。

## API 契约

- 不动 `api.generated.ts`（posts 端点已在快照）；如需回归：起后端(8080) 后 `npm run openapi:drift`。

## 落库验证顺序

1. `npm install`（加三个依赖）→ `npm run type-check`。
2. 写 API 封装层 + `api.test.ts` → 测试绿。
3. 写列表 / 创建 / 详情组件 + 对应测试 → 测试绿。
4. `npm run test` + `npm run build` 全绿。
5. 起后端(8080) + 前端(3000) 手动 e2e 走查三页（参考 `frontend/tests/e2e` 既有模式）。
6. 提交 `frontend` 子仓；父仓 bump submodule 指针。
