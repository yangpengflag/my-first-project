# posts Specification

## Purpose
为已登录用户提供旅行攻略（Story）的创作与消费能力：草稿 / 发布、公开列表与详情、以及"我的帖子"视图，作者展示信息复用既有 `User` 身份。
## Requirements
### Requirement: 帖子数据模型与约束

系统 SHALL 以 `Post` 实体（继承 `BaseEntity`）持久化攻略，字段契约如下：
- `id`：UUID 主键（来自 BaseEntity）。
- `authorId`：UUID，帖子作者，不可为 `null`。
- `title`：非空字符串，长度 ≤ 200。
- `content`：非空 Markdown 文本（原始存储，渲染 / 净化由前端负责）。
- `coverImageUrl`：可选字符串，须符合 URL 形态。
- `tags`：`List<String>`，最多 10 个；每个 tag 长度 ≤ 30；写入时 `trim` 并转为小写（归一化，防大小写重复）。
- `status`：枚举，取值域严格限定为 `DRAFT` / `PUBLISHED`。
- `summary`：SHALL NOT 作为存储字段存在；读取时由 `content` 派生（见「摘要派生」Requirement）。

`Post` 的软删除行 SHALL 通过<b>仓储层显式过滤</b>排除：`PostRepository` 提供 `findByStatusAndDeletedFalse` / `findByAuthorIdAndDeletedFalse` / `findByIdAndDeletedFalse`，使所有对外查询自动排除软删除行（与 `User` 故意不加过滤相反，因 `User` 鉴权需查已删行）。软删除标志由 `BaseEntity.deleted`（布尔，默认 `false`）承载，本 capability 不引入物理删除。

#### Scenario: 创建合法帖子成功落库

- **WHEN** 携带有效令牌提交 `POST /api/posts` 含 `{ "title": "Top 5 hikes near Chengdu", "content": "# ...", "tags": ["Hiking", "Sichuan"], "status": "DRAFT" }`
- **THEN** 返回 `201 Created`，响应体含非空 `id` 与 `author_id` 等于令牌主体
- **AND** `tags` 在库中以小写 `["hiking","sichuan"]` 存储

#### Scenario: 超限字段被拒

- **WHEN** 提交 `title` 长度 > 200，或 `tags` 含第 11 个元素，或单个 tag 长度 > 30
- **THEN** 返回 `400 Bad Request`，`error.code` 为 `"VALIDATION_FAILED"`，`error.details` 逐项指明违规字段

#### Scenario: 软删除帖子自动从查询中消失

- **GIVEN** 存在已软删除（`deleted` 为 `true`）的 PUBLISHED 帖子
- **WHEN** 通过列表或详情查询该帖子
- **THEN** 该帖子不出现在任何公开或私有列表 / 详情结果中（`AndDeletedFalse` 过滤生效）

---

### Requirement: 创建帖子（authorId 取自令牌）

`POST /api/posts` SHALL 创建帖子，并以 JWT 令牌主体（`sub`）作为 `authorId`，不得接受客户端传入的 `authorId`。`status` 来自请求体，缺省为 `DRAFT`；允许直接以 `PUBLISHED` 发布。

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用 `POST /api/posts`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

#### Scenario: 客户端伪造 authorId 被忽略

- **WHEN** 请求体含 `authorId` 字段
- **THEN** 系统忽略该字段，帖子 `authorId` 恒等于令牌主体

---

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

### Requirement: 帖子详情（公开、已发布）

`GET /api/posts/{id}` SHALL 返回指定已发布帖子的完整信息；当帖子不存在、已被软删除或状态非 `PUBLISHED` 时，SHALL 返回 `404 Not Found`，`error.code` 为 `"POST_NOT_FOUND"`。

#### Scenario: 成功获取详情

- **WHEN** `GET /api/posts/{已发布帖子id}` 不带鉴权
- **THEN** 返回 `200 OK`，含 `title` / `content` / `cover_image_url` / `tags` / `status` / `author_name` / `author_avatar_url` / `summary` / `created_at` / `updated_at`

#### Scenario: 草稿 / 已删返回 404

- **WHEN** 以 DRAFT 帖子 id 或已软删帖子 id 调用详情
- **THEN** 返回 `404 Not Found`，`error.code` 为 `"POST_NOT_FOUND"`

---

### Requirement: 编辑帖子（仅作者本人）

`PUT /api/posts/{id}` SHALL 允许作者本人更新 `title` / `content` / `coverImageUrl` / `tags` / `status`（含 `DRAFT`→`PUBLISHED` 发布）。非作者调用 SHALL 返回 `403 Forbidden`，`error.code` 为 `"NOT_POST_AUTHOR"`；未鉴权返回 `401 UNAUTHENTICATED`；帖子不存在返回 `404 POST_NOT_FOUND`。

#### Scenario: 作者发布草稿

- **GIVEN** 作者持有令牌，存在其 DRAFT 帖子 P
- **WHEN** `PUT /api/posts/{P.id}` 提交 `{ "status": "PUBLISHED" }`
- **THEN** 返回 `200 OK`，帖子状态变为 `PUBLISHED` 且出现在公开列表

#### Scenario: 他人编辑被拒

- **GIVEN** 用户 B 持有令牌，帖子 P 作者为 A
- **WHEN** B 调用 `PUT /api/posts/{P.id}`
- **THEN** 返回 `403 Forbidden`，`error.code` 为 `"NOT_POST_AUTHOR"`

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

---

### Requirement: 摘要派生（不存储）

`summary` SHALL 在读取时由 `content` 派生：剥离 Markdown 语法后取前 160 字符纯文本（中文按字符计），超长截断且不抛异常。系统 SHALL NOT 为 `summary` 维护独立存储列。

#### Scenario: 由 Markdown 内容派生摘要

- **GIVEN** 帖子 `content` 为 `# 标题\n这是**加粗**正文，包含 [链接](http://x.com)。`
- **WHEN** 列表或详情返回该帖子
- **THEN** `summary` 为剥离语法后的纯文本前 160 字符（如 `标题 这是加粗正文，包含 链接。`）

#### Scenario: 长内容截断

- **WHEN** `content` 纯文本长度 > 160
- **THEN** `summary` 恰为前 160 字符，长度不超过 160

---

### Requirement: 响应安全边界——白名单与敏感字段隔离

`PostResponse` / `PostSummary` SHALL 采用白名单 DTO 输出，字段严格限定为：`id` / `title` / `content` / `cover_image_url` / `tags` / `status` / `author_id` / `author_name` / `author_avatar_url` / `summary` / `created_at` / `updated_at` / `comment_count` / `up_vote_count` / `bookmark_count` / `request_id`（顶层信封）。任何响应 SHALL NOT 包含 `deleted_at`；作者信息 SHALL 仅限 `display_name` + `avatar_url`，不得泄露 `email` 等凭证 / 隐私字段。所有成功与错误响应均携带顶层 `request_id`（源自 `RequestIdFilter`），契约以 `frontend/openapi/openapi.json` 为准。

#### Scenario: 详情响应不含 deleted_at

- **WHEN** `GET /api/posts/{id}` 返回 `200`
- **THEN** 响应 JSON 中**不**出现 `deleted_at` / `deletedAt` 子串

#### Scenario: 作者信息不含邮箱

- **WHEN** 列表 / 详情返回含 `author_name` 的帖子
- **THEN** 响应 JSON 中**不**出现作者 `email` 字段
