## MODIFIED Requirements

### Requirement: 公开帖子列表（含作者展示信息与互动统计）

`GET /api/posts` SHALL 返回 PUBLISHED 帖子分页列表，结果项（`PostSummary`）SHALL 包含 `author_name`、`author_avatar_url`，以及互动统计字段 `comment_count` / `up_vote_count` / `bookmark_count`；作者信息由 `author_id` 一次批量解析（非 N+1），统计由聚合查询实时获取（不在 `Post` 实体冗余存储）。

默认排序 `sort=latest`（按 `created_at` DESC）；允许 `sort=top`（`up_vote_count` DESC）与 `sort=most_commented`（`comment_count` DESC）。分页支持两种模式：
- `sort=latest`：基于 `created_at` 的 **cursor** 分页，请求 `cursor=<opaque>`，响应返回 `next_cursor`（可空）与 `has_more`。
- `sort=top` / `sort=most_commented`：**offset** 分页，请求 `page`（从 1 开始，默认 1）与 `size`（默认 20，上限 100，超限以 100 截断），响应返回 `page` / `size` / `total`。

响应信封 SHALL 始终包含 `items` / `next_cursor` / `has_more`，offset 模式额外包含 `page` / `size` / `total`（详见「列表排序与混合分页契约」Requirement）。

#### Scenario: 列表仅含已发布且携带作者信息与统计数

- **GIVEN** 存在 3 篇 PUBLISHED 与 2 篇 DRAFT 帖子，其中某 PUBLISHED 帖有 4 条评论（1 条已软删）、6 个 UP 投票、2 个收藏
- **WHEN** `GET /api/posts` 不带鉴权
- **THEN** 返回 `200 OK`，仅含 3 篇 PUBLISHED
- **AND** 该项含 `author_name`（=作者 `User.displayName`）与 `author_avatar_url`（=作者 `User.avatarUrl`）
- **AND** 该项 `comment_count` = 3（含回复、排除软删）、`up_vote_count` = 6、`bookmark_count` = 2

#### Scenario: 分页 size 上限截断

- **WHEN** `GET /api/posts?size=200`
- **THEN** 实际生效 `size` 为 100，响应含分页元信息

#### Scenario: 作者已软删时帖子仍展示、作者名回退

- **GIVEN** 某 PUBLISHED 帖子的作者已被软删除（`DELETED`）
- **WHEN** 该帖子出现在列表
- **THEN** 帖子照常展示，`author_name` 回退为占位文案（如 `"[unknown user]"`），不泄露作者 `email` 等敏感字段

#### Scenario: 默认 latest 排序与 cursor 翻页

- **GIVEN** 存在 25 篇 PUBLISHED 帖子，`size=20`
- **WHEN** 首次 `GET /api/posts?sort=latest`
- **THEN** 返回 20 项，`has_more` = true，`next_cursor` 非空
- **AND** 当携带该 `next_cursor` 再次请求时，返回后续 5 项，`has_more` = false，`next_cursor` 为空

#### Scenario: 切到 top / most_commented 走 offset 分页

- **WHEN** `GET /api/posts?sort=top&page=2&size=10`
- **THEN** 返回第 2 页 10 项，按 `up_vote_count` DESC 排序，响应含 `page` = 2、`size` = 10、`total` 为 PUBLISHED 总数
- **AND** 此模式下忽略 `cursor` 参数（若存在）

---

### Requirement: 我的帖子（含互动统计）

`GET /api/posts/me` SHALL 返回当前令牌主体用户的全部帖子（含 `DRAFT` 与 `PUBLISHED`），`author_id` 由令牌主体推导；需鉴权，未鉴权返回 `401 UNAUTHENTICATED`。返回项 SHALL 与「公开帖子列表」一致携带 `comment_count` / `up_vote_count` / `bookmark_count` 统计字段，并支持相同的 `sort` / `cursor` / `page` / `size` 分页参数与统一信封。

#### Scenario: 返回当前用户所有状态帖子且含统计数

- **GIVEN** 用户 U 有 1 篇 DRAFT 与 2 篇 PUBLISHED，其中某帖有 3 条评论、5 个 UP 投票、1 个收藏
- **WHEN** U 携带令牌调用 `GET /api/posts/me`
- **THEN** 返回 `200 OK`，含全部 3 篇（不限 PUBLISHED）
- **AND** 该项含 `comment_count` = 3、`up_vote_count` = 5、`bookmark_count` = 1

#### Scenario: 未鉴权被拒

- **WHEN** 未携带令牌调用 `GET /api/posts/me`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

---

### Requirement: 响应安全边界——白名单与敏感字段隔离

`PostResponse` / `PostSummary` SHALL 采用白名单 DTO 输出，字段严格限定为：`id` / `title` / `content` / `cover_image_url` / `tags` / `status` / `author_id` / `author_name` / `author_avatar_url` / `summary` / `created_at` / `updated_at` / `comment_count` / `up_vote_count` / `bookmark_count` / `request_id`（顶层信封）。任何响应 SHALL NOT 包含 `deleted_at`；作者信息 SHALL 仅限 `display_name` + `avatar_url`，不得泄露 `email` 等凭证 / 隐私字段。所有成功与错误响应均携带顶层 `request_id`（源自 `RequestIdFilter`），契约以 `frontend/openapi/openapi.json` 为准。

#### Scenario: 详情响应不含 deleted_at

- **WHEN** `GET /api/posts/{id}` 返回 `200`
- **THEN** 响应 JSON 中**不**出现 `deleted_at` / `deletedAt` 子串

#### Scenario: 作者信息不含邮箱

- **WHEN** 列表 / 详情返回含 `author_name` 的帖子
- **THEN** 响应 JSON 中**不**出现作者 `email` 字段

## ADDED Requirements

### Requirement: 列表排序与混合分页契约

列表接口（`GET /api/posts` 与 `GET /api/posts/me`）SHALL 通过 `sort` 查询参数选择排序与分页模式：
- `latest`（默认）：按 `created_at` DESC，使用 **cursor** 分页；`cursor` 为不透明令牌（编码末项的 `created_at` ISO8601 时间戳与 `id`，如 `base64(createdAtISO + "|" + id)`），服务端按 `(created_at, id) < (cursor.createdAt, cursor.id)` 截断；`sort≠latest` 时 `cursor` 参数被忽略。
- `top`：按 `up_vote_count` DESC，使用 **offset** 分页。
- `most_commented`：按 `comment_count` DESC，使用 **offset** 分页。

响应信封 SHALL 统一为 `PostListResponse`：始终含 `items`（数组）、`next_cursor`（字符串或 null）、`has_more`（布尔）；offset 模式额外含 `page`（从 1 开始）、`size`、`total`。`size` 默认 20，上限 100。统计字段语义：`comment_count` 为该帖全部评论（含回复）且排除软删计数；`up_vote_count` 仅计 `vote_type = 'UP'`；`bookmark_count` 为有效收藏计数（取消收藏为物理删行，天然有效）。

#### Scenario: cursor 仅 latest 可用

- **WHEN** `GET /api/posts?sort=top&cursor=abc`
- **THEN** 服务端忽略 `cursor`，按 offset（`page`/`size`）逻辑处理并返回 `page`/`size`/`total`

#### Scenario: 统一信封字段齐备

- **WHEN** 任意排序下调用列表接口
- **THEN** 响应含 `items`、`next_cursor`、`has_more`；offset 模式额外含 `page`、`size`、`total`

#### Scenario: 统计口径正确

- **GIVEN** 某帖有 5 条评论（其中 2 条为回复、1 条已软删）、4 个 UP 与 1 个 DOWN 投票、3 个收藏
- **WHEN** 该帖出现在列表
- **THEN** `comment_count` = 4（含回复、排除软删），`up_vote_count` = 4（仅 UP，忽略 DOWN），`bookmark_count` = 3
