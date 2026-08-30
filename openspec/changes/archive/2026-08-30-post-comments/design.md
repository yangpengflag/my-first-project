## Context

- `backend` 为 Maven 单模块 Spring Boot 3.5（Java 17），标准分层（controller → service → repository），见 `backend-conventions.md`。
- 已落地 `common/BaseEntity`（UUID 主键 + `created_at`/`updated_at`/`deleted`）；软删除约定（见 `align-soft-delete-to-db-conventions`）：**业务实体不在类上声明 `@SQLRestriction`，而由仓储层 `findByXxxAndDeletedFalse` 显式过滤**。`User` 因鉴权需查已删行同样不加全局过滤。
- 响应 DTO 约定（见 `align-response-dto-to-backend-conventions`）：单资源响应继承 `com.mooc.backend.dto.response.BaseResponse`（自带 `request_id`），字段 `@JsonProperty("snake_case")` 白名单 + `WHITELISTED_FIELDS` 静态集合 + 序列化测试守护；列表端点直接返回 `Page<T>`（不带 `request_id`）。
- 鉴权：`auth-module` 已确立 JWT 主体即用户身份；`PostsController.currentUserId()` 从 `SecurityContextHolder` 取 UUID 主体，未认证抛 `PostException(ErrorCode.UNAUTHENTICATED)`；统一错误信封由 `GlobalExceptionHandler` 翻译。`SecurityConfig` 中 `GET /api/posts/*`（单段）为公开，但 `/api/posts/{id}/comments` 与 `/api/comments/{id}/replies` 不匹配该单段匹配器，默认落入 `anyRequest().authenticated()`，故评论读端点天然需 JWT（与本 change 决策一致，无需额外放行）。
- 动机与范围见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 实现评论「发布（顶层/回复）/ 顶层分页 / 回复分页 / 软删（顶层级联回复）」端点，作者展示信息复用 `User`。
- `Comment` 实体复用 `BaseEntity` 内核，软删走仓储层过滤。
- 严格遵守两层模型（顶层 + 回复）；响应严格白名单。

**Non-Goals:**
- 不做多级嵌套回复（仅两层：顶层 + 其直接回复）。
- 不做评论编辑（仅发布与删除）。
- 不做互动通知（被评论 / 被回复）→ 独立 `notifications` change。
- 不做评论排序切换、按作者筛选、富文本 / 表情。

## Decisions

### D1. 包与分层
新增 `com.mooc.backend.comments`，下设 `api/`（`CommentsController`、`CreateCommentRequest`、`CommentResponse`、`CommentSummary`）、`domain/`（`Comment`）、`repository/`（`CommentRepository`）、`service/`（`CommentService`）、`exception/`（`CommentException`）。完全贴合 `backend-conventions.md` 分层。

### D2. 实体与软删过滤（对齐 align-soft-delete-to-db-conventions）
`Comment extends BaseEntity`，**不**声明 `@SQLRestriction`；由 `CommentRepository` 通过 `findByPostIdAndParentCommentIdIsNullAndDeletedFalse` / `findByParentCommentIdAndDeletedFalse` / `findByIdAndDeletedFalse` 显式过滤。理由：与 `posts` 同构，保持仓库约定一致、可预测。

### D3. 两层树形模型与两层强制校验
仅支持「顶层评论（`parentCommentId = null`）+ 其回复（`parentCommentId` = 某**顶层**评论 id）」两层，不做无限嵌套。校验：
- 回复的 `parentCommentId` 必须指向**同一帖子**下、且**本身是顶层评论**（`parentCommentId == null`）的评论；任一不满足 → `400 INVALID_PARENT_COMMENT`。
- 由此防止「回复嵌套在回复之下」破坏两层不变量。

`CommentRepository` 提供：
- `Page<Comment> findByPostIdAndParentCommentIdIsNullAndDeletedFalse(UUID postId, Pageable)`
- `Page<Comment> findByParentCommentIdAndDeletedFalse(UUID parentId, Pageable)`
- `Optional<Comment> findByIdAndDeletedFalse(UUID id)`
- `long countByParentCommentIdAndDeletedFalse(UUID parentId)`（用于顶层评论的 `reply_count`）
- `Optional<Comment> findByPostIdAndIdAndDeletedFalse(UUID postId, UUID id)`（校验回复父评论同帖且存在）
- `List<Comment> findAllByParentCommentIdAndDeletedFalse(UUID parentId)`（级联软删回复用）

### D4. 作者展示信息解析（避免 N+1）
`CommentService` 取回一页评论后，收集 `userId` 集合，调用 `UserRepository.findAllById(ids)` **一次** IN 查询，映射 `displayName`/`avatarUrl`；作者已软删时回退占位（`[unknown user]` / null），不泄露 `email`。与 `PostService.resolveAuthors` 同构。

### D5. 删除语义：顶层级联软删回复（避免孤儿）
- 删除**顶层评论**（`parentCommentId == null`）：先 `softDelete` 其全部回复（经 `findAllByParentCommentIdAndDeletedFalse` 加载后逐一 `softDelete` + save），再 `softDelete` 顶层评论本身。
- 删除**回复**（叶子节点，无子节点）：仅软删该回复。
- 这样避免「父删后回复仍存库、却只能通过已删父 id 拉取 → 父 404 致回复不可达」的孤儿问题。回放接口对软删对象一律 404（应用层过滤）。

### D6. DTO 与校验
- `CreateCommentRequest`：Java `record` + Jakarta 校验；`content` `@NotBlank` + 长度上限（常量 `MAX_COMMENT_LENGTH = 2000`）；`parentCommentId` 可空 `UUID`。
- `CommentResponse`（extends `BaseResponse`，snake_case 白名单）：`id`、`post_id`、`user_id`、`parent_comment_id`、`content`、`author_name`、`author_avatar_url`、`created_at`、`updated_at`、`reply_count`（顶层评论有意义，回复为 0）。`WHITELISTED_FIELDS` 静态集合 + 序列化测试守护，绝不输出 `deleted_at` / `email`。
- 列表 / 回复端点直接返回 `Page<CommentResponse>`（与 `PostsController.list` 返回 `Page<PostSummary>` 同构，列表项同样继承 `BaseResponse` 携带 `request_id`，不另建列表 DTO）。

### D7. 鉴权与错误码
- 复用 `auth-module` 的 JWT 过滤器；`CommentsController` 内 `currentUserId()` 与 `PostsController` 同构，未认证抛 `CommentException(ErrorCode.UNAUTHENTICATED)`。
- **全部端点鉴权**：`GET .../comments`、`GET .../replies`、`POST .../comments`、`DELETE .../comments` 均**需 JWT**（未认证返回 `401 UNAUTHENTICATED`）。读端点中 `currentUserId()` 仅作鉴权闸门（响应本身不含当前用户态）。
- 异常 → 错误码（由 `GlobalExceptionHandler` 路由统一信封，`auth-module` 需新增 `handleCommentException` 分支）：
  - `CommentException(ErrorCode.COMMENT_NOT_FOUND)` → `404`
  - `CommentException(ErrorCode.NOT_COMMENT_AUTHOR)` → `403`
  - `CommentException(ErrorCode.INVALID_PARENT_COMMENT)` → `400`
  - 帖子不存在复用 `ErrorCode.POST_NOT_FOUND` → `404`
  - `MethodArgumentNotValidException` → `400 VALIDATION_FAILED`（含 `error.details`）

### D8. 分页
列表/回复：`page`(默认0)/`size`(默认20)，`size` 上限钳制 50（同 `PostService.clampSize`）。顶层评论按 `created_at` 倒序；回复按 `created_at` 升序（时间线顺序）。

### D9. Schema 供给
`comments` 表沿用现有供给机制（Hibernate ddl-auto 或既有迁移），不引入新迁移体系。`parent_comment_id` 自引用，不加 DB 级外键级联（软删语义由应用层维护）。

### D10. API 契约
controller 加 springdoc 注解；实现后重新生成 `/v3/api-docs`，更新前端 `openapi.json` 进仓快照。

## Risks / Trade-offs

- **[reply_count 查询放大]** → 每页 ≤50 条顶层评论，各自 `countByParentCommentIdAndDeletedFalse` 一次，最坏 50 次/页；可接受（单页常量级）。优化可改 group-by 单次聚合，列为后续项。
- **[作者 N+1]** → D4 批量 IN 缓解。
- **[评论区需登录]** → 已决策：全部端点需 JWT，与"全部需要JWT"一致；帖子详情页评论区要求登录后可见。
- **[XSS / 内容净化]** → 同 `posts`：后端原样存储 `content`，净化责任在前端渲染层。
- **[大 content 存储]** → `TEXT` 列；长度上限在请求层校验，单测覆盖越界。
- **[级联软删代价]** → 顶层评论删除需额外加载+软删其回复（数量通常小）；可接受。若未来需保留回复，改 D5 为「父占位保留」方案即可。
