## Why

平台需要用户生成的旅行攻略（Story）——这是 project.md 中 `community` / `hot-posts` 首页区块插槽（`hot-posts` Region Slot）的核心内容（见术语表 `Story` 定义：标题 / 封面图 / 摘要 / 标签）。当前系统没有任何创建、发布、列表或读取攻略的 API。引入 `posts` capability，让已登录用户以 Markdown 创作攻略（草稿 / 已发布），并暴露公开列表 / 详情与需鉴权的"我的帖子"视图，复用既有的 `User` 身份与 `BaseEntity` 共享内核。

## What Changes

- 新增 `posts` capability，HTTP 接口位于 `/api/posts`：
  - `POST /api/posts` — 创建（DRAFT 或 PUBLISHED），`authorId` 取自 JWT `sub`，拒绝客户端传入。
  - `GET /api/posts` — 公开列表，仅 PUBLISHED，分页；每条携带作者展示信息（JOIN `User` 一次取出 `displayName` + `avatarUrl`）。
  - `GET /api/posts/{id}` — 公开详情（PUBLISHED），`summary` 为派生值。
  - `PUT /api/posts/{id}` — 作者本人编辑标题 / 内容 / 标签 / 状态（含 DRAFT→PUBLISHED 发布）。
  - `GET /api/posts/me` — 需鉴权，返回当前用户全部帖子（任意状态），`authorId` 取自 JWT `sub`。
- 新增 JPA 实体 `Post`（继承 `BaseEntity`），位于 `backend/.../posts/domain/`，并显式声明 `@SQLRestriction("deleted_at IS NULL")`（普通业务实体，与 `User` 故意省略该注解相反）。
- `summary` 派生、不存储：读取时由 `content`（原始 Markdown）剥离语法取前 ~160 字符纯文本。
- 白名单 Response DTO（`PostResponse` / `PostSummary`）：绝不输出 `deletedAt`；作者公开信息仅限 `displayName` + `avatarUrl`（与 auth-module `UserResponse` 白名单一致）。
- 常量固化：标题 ≤ 200；标签 ≤ 10 个、单 tag ≤ 30 字符（写入时 `trim` + 小写归一化，与 auth 的 email 归一化同源防重思路）；分页默认 `size=20`、上限 `50`。

无 **BREAKING** 变更（仅新增端点与数据表）。

## Capabilities

### New Capabilities

- `posts`：用户旅行攻略（Story）的发布、编辑、公开列表 / 详情与"我的帖子"接口；涵盖数据模型、作者信息展示、摘要派生与安全边界。

### Modified Capabilities

- 无（不改动 `auth-module` 的 requirement）。

## Impact

- 新增数据表 `posts`；新增后端包 `com.mooc.backend.posts`（controller / service / repository / domain / dto）。
- 依赖既有 `auth` 模块的 `User`（列表/详情只读 JOIN 取作者展示信息）与 `common.BaseEntity` 内核。
- 鉴权：所有写操作与 `/me` 需 JWT；`authorId` 由令牌主体推导（与 auth-module `GET /api/auth/me` 同源模式）。
- 前端：`hot-posts` 区块（后续 change）将消费 `GET /api/posts`。
- API 契约（`/v3/api-docs`）将重新生成，供前端 `openapi.json` 进仓快照更新（见 project.md API 契约）。
