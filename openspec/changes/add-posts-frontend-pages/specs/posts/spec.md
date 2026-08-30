## Purpose

为已登录用户提供旅行攻略（Story）的创作与消费能力：草稿 / 发布、公开列表与详情、以及"我的帖子"视图，作者展示信息复用既有 `User` 身份。后端契约已落地于 `openspec/specs/posts/spec.md`；本增量仅补充**前端消费页面**的需求。

## ADDED Requirements

### Requirement: 公开帖子列表页（前端）

前端 SHALL 提供公开列表页（路由 `/posts`），消费 `GET /api/posts`，默认拉取第一页（公开、无需鉴权），并以卡片网格呈现 `PostSummary` 列表。页面 SHALL 覆盖四态：加载中（`Skeleton` 骨架屏）、有内容、空列表（引导文案 + CTA）、加载失败（错误描述 + 重试）。

#### Scenario: 首屏渲染已发布列表

- **WHEN** 用户访问列表页且后端返回 200 与若干 PUBLISHED 帖子
- **THEN** 页面以响应式网格（`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`）渲染卡片，每张含封面、`title`、`summary`(截断)、`tags`、`author_name`、`created_at`；无封面时用渐变占位兜底

#### Scenario: 空列表

- **WHEN** 后端返回空 `content`
- **THEN** 页面展示居中图标 + 「还没有攻略」引导文案 + 「发布第一篇」CTA（指向 `/posts/create`）

#### Scenario: 分页翻页

- **WHEN** 用户点击「下一页」且 `PagePostSummary.last` 为 false
- **THEN** 以 `page+1` 重新拉取并替换列表；到达末页时禁用「下一页」

---

### Requirement: 发布帖子页（前端，需登录）

前端 SHALL 提供创建页（路由 `/posts/create`），以 `<AuthGuard>` 包裹：未登录用户被重定向至 `/login?redirect=/posts/create`。页面 SHALL 提供标题输入、`@uiw/react-md-editor` 工具栏编辑器（Markdown 正文）、封面图 URL 输入、标签输入，以及「保存草稿」「发布」两个提交动作，分别提交 `status: "DRAFT"` / `"PUBLISHED"` 至 `POST /api/posts`（`authorId` 由后端 JWT 主体推导，前端不传）。

#### Scenario: 校验失败给出字段级提示

- **WHEN** 用户提交 `title` 为空或 >200、或 `content` 为空、或 `tags` >10 个 / 单项 >30 字符
- **THEN** 前端 zod 校验拦截并高亮对应字段；若仍绕过到达后端且返回 `VALIDATION_FAILED`，其 `details` 映射回字段错误展示

#### Scenario: 未登录被守卫拦截

- **WHEN** 未登录用户直接访问 `/posts/create`
- **THEN** `<AuthGuard>` 将其重定向至 `/login?redirect=/posts/create`，不渲染表单

#### Scenario: 发布成功跳转详情

- **WHEN** 已登录用户提交合法内容并点击「发布」
- **THEN** 调用 `POST /api/posts` 成功，前端 `router.push('/posts/'+id)` 跳转详情页

---

### Requirement: 帖子详情页（前端，公开）

前端 SHALL 提供详情页（路由 `/posts/[id]`），消费 `GET /api/posts/{id}`，以白名单净化渲染 `content` 的 Markdown（`react-markdown` + `rehype-sanitize`，剥离 `<script>` 等危险内容，防 XSS）。页面 SHALL 覆盖四态；当返回 `POST_NOT_FOUND` 时展示 Not Found 态（而非崩溃）。

#### Scenario: 成功渲染已发布帖子

- **WHEN** 用户访问已发布帖子详情
- **THEN** 页面展示封面（`aspect-[16/9]` + 占位兜底）、`title`、`author_name`/`author_avatar_url`、格式化 `created_at`、`tags`、以及净化后的 `content` 正文

#### Scenario: 帖子不存在 / 非公开

- **WHEN** 后端返回 `404 POST_NOT_FOUND`（草稿 / 已软删 / id 不存在）
- **THEN** 页面展示 Not Found 态：居中图标 + 「攻略不存在或已下架」+ 返回列表 CTA

#### Scenario: Markdown 净化生效

- **WHEN** `content` 含 `<script>` 或 `onerror` 等危险片段
- **THEN** 渲染后危险内容被 `rehype-sanitize` 剥离，仅保留白名单内的安全标签与属性
