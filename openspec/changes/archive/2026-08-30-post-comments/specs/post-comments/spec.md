## Purpose

为帖子详情页提供评论与回复能力：两层（顶层评论 + 其回复）树形结构，作者展示信息复用既有 `User` 身份，软删除与 `posts` 同约定（仓储层 `AndDeletedFalse` 显式过滤）。全部端点需 JWT 认证。

## ADDED Requirements

### Requirement: 评论数据模型与约束

系统 SHALL 以 `Comment` 实体（继承 `BaseEntity`）持久化评论，字段契约如下：
- `id`：UUID 主键（来自 BaseEntity）。
- `postId`：UUID，所属帖子，不可为 `null`。
- `userId`：UUID，评论作者，不可为 `null`。
- `content`：非空文本（`TEXT`），长度上限 2000 字符（写入时校验）。
- `parentCommentId`：UUID，可空；为 `null` 表示顶层评论，非 `null` 表示对某顶层评论的回复，且 MUST 指向同一帖子下的顶层评论。

`Comment` SHALL **不**在类上声明 `@SQLRestriction`；所有查询通过仓储层 `findByXxxAndDeletedFalse` 显式排除软删除行（与 `posts` 约定一致）。软删除行由 BaseEntity 的 `deleted` 承载，本 capability 不引入物理删除（评论删除走软删）。

#### Scenario: 创建合法评论落库

- **WHEN** 携带有效令牌提交 `POST /api/posts/{postId}/comments` 含 `{ "content": "Great hike!", "parentCommentId": null }`
- **THEN** 返回 `201 Created`，响应体含非空 `id` 与 `userId` 等于令牌主体、`postId` 等于路径参数

#### Scenario: 超限 content 被拒

- **WHEN** 提交 `content` 长度 > 2000 或为空
- **THEN** 返回 `400 Bad Request`，`error.code` 为 `"VALIDATION_FAILED"`

#### Scenario: 跨帖回复父评论被拒

- **WHEN** 提交 `parentCommentId` 指向另一个帖子的评论
- **THEN** 返回 `400 Bad Request`，`error.code` 为 `"INVALID_PARENT_COMMENT"`

#### Scenario: 回复不能嵌套在回复之下

- **WHEN** `parentCommentId` 指向一条本身已是回复（`parentCommentId != null`）的评论
- **THEN** 返回 `400 Bad Request`，`error.code` 为 `"INVALID_PARENT_COMMENT"`

---

### Requirement: 发布评论（顶层 / 回复）

`POST /api/posts/{postId}/comments` SHALL 创建评论，`userId` 取自 JWT 令牌主体；`parentCommentId` 为空则创建顶层评论，否则创建对该顶层评论的回复（父评论须存在、同帖且为顶层评论）。帖子不存在 SHALL 返回 `404 POST_NOT_FOUND`。

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用 `POST /api/posts/{postId}/comments`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

#### Scenario: 回复父评论跨帖被拒

- **WHEN** `parentCommentId` 不属于路径 `postId` 下的评论
- **THEN** 返回 `400`，`error.code` 为 `"INVALID_PARENT_COMMENT"`

---

### Requirement: 顶层评论分页列表（需 JWT）

`GET /api/posts/{postId}/comments` SHALL 返回该帖子顶层评论（`parentCommentId = null`）的分页列表，默认按 `created_at` 倒序；每项 SHALL 含 `reply_count`（该评论的回复数）与作者展示信息（`authorName` / `authorAvatarUrl`）。列表为需鉴权端点（未认证返回 `401 UNAUTHENTICATED`）。分页参数：`page`（默认 0）、`size`（默认 20，上限 50，超限截断）。

#### Scenario: 仅返回顶层评论并携带 reply_count

- **GIVEN** 帖子 P 有 2 条顶层评论，其中 1 条有 3 条回复
- **WHEN** 携带有效令牌调用 `GET /api/posts/{P.id}/comments`
- **THEN** 返回 200，仅含 2 条顶层评论；含回复的那条 `reply_count = 3`

#### Scenario: 分页 size 上限截断

- **WHEN** 携带有效令牌调用 `GET /api/posts/{postId}/comments?size=200`
- **THEN** 实际生效 `size` 为 50，响应含分页元信息

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用 `GET /api/posts/{postId}/comments`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

---

### Requirement: 回复分页列表（需 JWT）

`GET /api/comments/{commentId}/replies` SHALL 返回指定评论的回复分页（按 `created_at` 升序）。父评论不存在或已软删 SHALL 返回 `404 COMMENT_NOT_FOUND`。该端点为需鉴权端点（未认证返回 `401 UNAUTHENTICATED`）。

#### Scenario: 成功获取回复

- **WHEN** 携带有效令牌调用 `GET /api/comments/{存在且未删的评论 id}/replies`
- **THEN** 返回 `200 OK`，含该评论的回复，按时间升序

#### Scenario: 父评论不存在返回 404

- **WHEN** 以已软删或不存在的评论 id 调用
- **THEN** 返回 `404`，`error.code` 为 `"COMMENT_NOT_FOUND"`

#### Scenario: 未携带令牌返回 401

- **WHEN** 未携带 `Authorization` 调用 `GET /api/comments/{commentId}/replies`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`

---

### Requirement: 删除评论（仅作者，软删除；顶层级联回复）

`DELETE /api/comments/{commentId}` SHALL 允许作者本人软删除评论；非作者调用 SHALL 返回 `403 NOT_COMMENT_AUTHOR`；评论不存在或已软删 SHALL 返回 `404 COMMENT_NOT_FOUND`。删除**顶层评论**时，系统 SHALL 级联软删其下全部回复（避免回复成为不可达孤儿）；删除回复（叶子）无需级联。

#### Scenario: 作者删除顶层评论级联其回复

- **GIVEN** 用户 U 持有令牌，存在其顶层评论 C 及其 3 条回复
- **WHEN** `DELETE /api/comments/{C.id}`
- **THEN** 返回 `204 No Content`；C 与其 3 条回复均从列表/回复接口消失（软删过滤生效）

#### Scenario: 作者删除回复不影响兄弟

- **GIVEN** 顶层评论 C 有回复 R1、R2
- **WHEN** 作者删除 R1
- **THEN** 返回 `204`；R1 消失，R2 与 C 仍可见

#### Scenario: 他人删除被拒

- **WHEN** 用户 B（非作者）调用 `DELETE /api/comments/{C.id}`
- **THEN** 返回 `403`，`error.code` 为 `"NOT_COMMENT_AUTHOR"`

---

### Requirement: 响应安全边界——白名单与敏感字段隔离

`CommentResponse` / `CommentSummary` SHALL 采用白名单 DTO 输出，字段严格限定为：`id` / `post_id` / `user_id` / `parent_comment_id` / `content` / `author_name` / `author_avatar_url` / `created_at` / `updated_at` / `reply_count`。任何响应 SHALL NOT 包含 `deleted_at`；作者信息 SHALL 仅限 `displayName` + `avatarUrl`，不得泄露 `email` 等隐私字段。

#### Scenario: 响应不含 deleted_at 与 email

- **WHEN** 评论列表/详情返回 `200`
- **THEN** 响应 JSON 中**不**出现 `deleted_at` / `deletedAt` / 作者 `email` 子串
