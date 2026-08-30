## 1. 依赖与脚手架

- [x] 1.1 `package.json` 增加 `@uiw/react-md-editor`、`react-markdown`、`rehype-sanitize`（锁定兼容 React 18 的版本）；执行 `npm install`。
- [x] 1.2 新建 `app/posts/` 路由组：列表 `page.tsx`、创建 `create/page.tsx`、详情 `[id]/page.tsx` 占位外壳，及 `_components/` 目录。

## 2. API 封装层

- [x] 2.1 `lib/posts/types.ts`：从 `api.generated.ts` 派生 `PostResponse` / `PostSummary` / `CreatePostRequest` / `PagePostSummary` / `PostListParams`，收紧关键必填字段。
- [x] 2.2 `lib/posts/api.ts`：`postsApi.list` / `create` / `getById`，复用 `fetchFromBackend<T>`。
- [x] 2.3 `lib/posts/messages.ts`：`describePostError` 映射帖子相关错误码（含 `POST_NOT_FOUND` / `NOT_POST_AUTHOR` / `VALIDATION_FAILED` / `UNAUTHENTICATED`）。
- [x] 2.4 `lib/posts/api.test.ts`：mock `fetchFromBackend` 验证成功与错误分支（TDD 红 → 绿）。

## 3. 列表页

- [x] 3.1 `app/posts/page.tsx`（Server 外壳 + 标题 / 副标题）+ `_components/PostList.tsx`（四态状态机）。
- [x] 3.2 `_components/PostCard.tsx`：封面渐变占位兜底 + 标题 / `summary` / `tags` / 作者 / 日期；`aspect-[16/9]`；整卡链接。
- [x] 3.3 基于 `PagePostSummary` 元信息的上一页 / 下一页分页。
- [x] 3.4 `PostList.test.tsx` / `PostCard.test.tsx`：四态与无图占位覆盖。

## 4. 创建页（需登录）

- [x] 4.1 `app/posts/create/page.tsx`：`<AuthGuard>` 包裹 + 创建表单 Client 组件。
- [x] 4.2 `_components/PostEditor.tsx`：react-hook-form + zod 校验（title ≤200 / content 非空 / tags ≤10 且每项 ≤30 / coverImageUrl URL）；`@uiw/react-md-editor` 工具栏（`next/dynamic` `ssr:false`）；双动作「保存草稿」/「发布」。
- [x] 4.3 `_components/TagInput.tsx`：回车 / 逗号添加 chip、可删、触顶禁用、去空格。
- [x] 4.4 `VALIDATION_FAILED.details` → 字段错误回填；提交中 `Loader2` + `disabled`。
- [x] 4.5 `PostEditor.test.tsx` / `TagInput.test.tsx`：校验与守卫覆盖。

## 5. 详情页

- [x] 5.1 `app/posts/[id]/page.tsx`（Server 外壳 + 返回导航）+ `_components/PostDetail.tsx`（拉取 + 四态）。
- [x] 5.2 Markdown 渲染器：`react-markdown` + `rehype-sanitize` 白名单净化；作者回退占位；封面占位兜底；`created_at` 格式化。
- [x] 5.3 `PostDetail.test.tsx`：`POST_NOT_FOUND` Not Found 态 + 净化验证。

## 6. 收尾

- [x] 6.1 `npm run type-check` && `npm run test` && `npm run build` 全绿。
- [x] 6.2 起后端(8080) + 前端(3000) e2e 走查三页。
- [x] 6.3 提交 `frontend` 子仓；父仓 bump submodule 指针。
