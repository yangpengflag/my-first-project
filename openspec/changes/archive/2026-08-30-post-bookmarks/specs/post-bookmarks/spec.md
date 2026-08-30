## Purpose

为帖子详情页与「我的收藏」页提供收藏能力：一人一帖唯一约束下的收藏切换，以及当前用户收藏帖子的分页列表（复用 `PostSummary`）。

## ADDED Requirements

### Requirement: 收藏数据模型与唯一约束

系统 SHALL 以 `Bookmark` 实体（继承 `BaseEntity`）持久化收藏，字段契约如下：
- `id`：UUID 主键（来自 BaseEntity）。
- `postId`：UUID，所属帖子，不可为 `null`。
- `userId`：UUID，收藏用户，不可为 `null`。

`Bookmark` 类 SHALL 声明 `@Table(uniqueConstraints = @UniqueConstraint(name="uk_bookmarks_post_user", columnNames={"post_id","user_id"}))`，保证同一用户对同一帖子仅一行。**取消收藏 SHALL 走物理删除**（非软删），以释放唯一约束槽位、允许再次收藏；`deleted` 列恒为 false。

#### Scenario: 一人一帖唯一约束生效

- **WHEN** 同一用户对同一帖子尝试写入第二条 Bookmark 行
- **THEN** 数据库唯一约束 `uk_bookmarks_post_user` 拒绝，应用层捕获冲突并返回已收藏态（不 500）

#### Scenario: 取消后允许再次收藏

- **GIVEN** 用户 U 收藏了帖子 P，随后取消（物理删除该行）
- **WHEN** U 再次收藏 P
- **THEN** 成功创建新行，无唯一约束冲突

---

### Requirement: 收藏切换（toggle）

`POST /api/posts/{postId}/bookmark` SHALL 依据当前用户既有收藏执行切换：不存在→收藏（创建），已存在→取消（删除）。返回 `{ post_id, bookmarked }`（`bookmarked` 为当前是否已收藏）。需鉴权，未鉴权返回 `401 UNAUTHENTICATED`；帖子不存在返回 `404 POST_NOT_FOUND`。

#### Scenario: 首次收藏

- **WHEN** 用户对未收藏的帖子提交 `POST /api/posts/{postId}/bookmark`
- **THEN** 返回 `200 OK`，`bookmarked` 为 `true`，库中存在一行

#### Scenario: 再次调用取消

- **WHEN** 已收藏的用户再次调用同端点
- **THEN** 返回 `200 OK`，`bookmarked` 为 `false`，该行被物理删除

#### Scenario: 帖子不存在返回 404

- **WHEN** 以不存在/已软删的帖子 id 调用
- **THEN** 返回 `404`，`error.code` 为 `"POST_NOT_FOUND"`

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

---

### Requirement: 我的收藏列表（需鉴权，全量含失效占位）

`GET /api/bookmarks` SHALL 返回当前令牌用户收藏的帖子分页（`Page<BookmarkSummary>`），**包含该用户全部收藏项**（不静默跳过失效帖子），按收藏时间倒序（最近收藏在前）。每项 SHALL 含 `post_id`、`available`（布尔）、`post`（`PostSummary`，仅当 `available=true` 时非 null）。当原帖子已软删 / 非 `PUBLISHED` / 不存在时，`available=false` 且 `post=null`，前端据以渲染「帖子已不可用」占位。分页参数：`page`（默认 0）、`size`（默认 20，上限 50，超限截断）。需鉴权，未鉴权返回 `401 UNAUTHENTICATED`。

#### Scenario: 返回当前用户全部收藏（含失效占位）

- **GIVEN** 用户 U 收藏了帖子 P1（PUBLISHED）与 P2（后收藏），P3 已软删
- **WHEN** U 携带令牌调用 `GET /api/bookmarks`
- **THEN** 返回 `200 OK`，含 P1、P2、P3 三项（按 P2、P1、P3 倒序）；P1/P2 的 `available=true` 且含 `post`，P3 的 `available=false` 且 `post=null`

#### Scenario: 分页不含空档

- **GIVEN** 用户 U 收藏了 60 个帖子，其中 30 个已失效
- **WHEN** U 调用 `GET /api/bookmarks?size=20&page=0`
- **THEN** 返回满 20 项（含失效占位），`total` 为 60，无空档

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用 `GET /api/bookmarks`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

---

### Requirement: 响应安全边界——白名单

列表响应复用的 `PostSummary` SHALL 保持既有白名单（见 `posts` capability），不含 `deleted_at` / 作者 `email` 等隐私字段。`BookmarkResponse` SHALL 仅含 `post_id` / `bookmarked`。

#### Scenario: 列表响应不含敏感字段

- **WHEN** `GET /api/bookmarks` 返回 `200`
- **THEN** 响应 JSON 中**不**出现 `deleted_at` / `deletedAt` / 作者 `email` 子串
