## Context

- `backend` 为 Maven 单模块 Spring Boot 3.5（Java 17），标准分层（`controller → service → repository`，不可反向），代码组织见 `backend-conventions.md`。
- 已落地 `common/BaseEntity`（UUID 主键 + `created_at`/`updated_at`/`deleted_at`，但**不在基类**施加 `@SQLRestriction`，由业务实体自行声明）；`auth/domain/User`（`displayName`/`avatarUrl`/`email`/`status` 等，`users` 表）。
- 鉴权：`auth-module` 已确立 JWT 主体即用户身份、`GET /api/auth/me` 同源模式、统一错误信封 `{error:{code,message}}`、凭证字段白名单出网。
- 动机与范围见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 实现帖子「创建 / 公开列表 / 详情 / 编辑 / 我的帖子」五端点，作者展示信息复用 `User`。
- `Post` 实体复用 `BaseEntity` 内核并声明软删过滤；`summary` 读取时派生。
- 响应严格白名单，安全边界与 `auth-module` 一致。

**Non-Goals:**
- 不暴露 DELETE（软删除能力由 BaseEntity 提供，未来单独 change 暴露）。
- 不做评论 / 点赞 / 收藏 / 私信（各自独立 capability）。
- 本期不做按标签筛选、全文搜索、富媒体处理。
- 不做后端 SSR 渲染 Markdown（净化由前端负责，见 Risks）。

## Decisions

### D1. 包与分层
新增 `com.mooc.backend.posts`，下设 `domain/`（`Post` + `PostStatus`）、`repository/`、`service/`、`controller/`、`dto/`。完全贴合 `backend-conventions.md` 分层，依赖方向保持单向。

### D2. 实体与软删过滤
`Post extends BaseEntity`，类级 `@SQLRestriction("deleted_at IS NULL")`。理由：普通业务实体无需查已删行，过滤应自动化（见 BaseEntity 注释「后续业务模块在自身类声明」）。`status` 用 `@Enumerated(STRING)` 持久化为 `draft`/`published`。

### D3. tags 存储
`@ElementCollection` + 连接表 `post_tags(post_id, tag)`，归一化、可查询。`PostService` 在写入前对 tags 做 `trim` + `toLowerCase(Locale.ROOT)`，并在请求层校验数量（≤10）与单长（≤30）。

### D4. 作者展示信息解析（避免 N+1 与模块耦合）
`PostRepository` 仅负责 `Post`；`PostService` 在取回一页帖子后，收集 `authorId` 集合，调用 `UserRepository.findAllById(ids)` **一次** IN 查询得到 `List<User>`，再映射 `displayName`/`avatarUrl` 到 DTO。作者不存在（已软删）时回退占位文案。
- 备选：JPA `@ManyToOne` 直接关联 `User` →  rejected：跨模块实体关联带来懒加载 / 级联复杂度，且 `User` 不声明 `@SQLRestriction` 会增加语义耦合。批量 IN 查询更可控。
- 这与 proposal 所述「JOIN 一次取出」语义等价，实现上以应用层批量 IN 替代跨模块 JPQL join。

### D5. summary 派生
纯函数 `MarkdownSummary.derive(content, max=160)`：正则剥离 `#`/加粗/链接/图片等 Markdown 语法 → 折叠空白 → 取前 160 字符（中文按 `codePoint` 计）。不引入 Markdown 解析库（过度）。
- 备选：存储独立 `summary` 列 → rejected：与用户字段表不一致、需双写同步，YAGNI。

### D6. DTO 与校验
- `CreatePostRequest` / `UpdatePostRequest`：Java `record` + Jakarta 校验（`@NotBlank` title/content、`@Size` tags、`@Pattern` coverImageUrl 形态）。message 英文。
- `PostResponse` / `PostSummary`：record（与 `UserResponse` 同构——**camelCase** JSON 字段、无 `BaseResponse` 基类；项目当前未落地 `BaseResponse`），附 `WHITELISTED_FIELDS` 静态集合 + `from()` 工厂作安全边界护栏，绝不输出 `deletedAt`；`authorId` 在响应中保留（前端可能需要），但 `email` 永不出现。
- 请求体里的 `authorId`（若存在）在 controller 层直接丢弃，以令牌主体覆盖。

### D7. 鉴权与错误码
- 复用既有 JWT 过滤器：写操作与 `/me` 方法要求已认证；未认证由全局拦截返回 `401 UNAUTHENTICATED`（与 auth-module 一致）。
- `authorId` 从 `SecurityContext` / JWT `sub` 解析（同 `GET /api/auth/me` 模式）。
- 异常 → 错误码映射（由 `GlobalExceptionHandler` 路由到统一信封）：
  - `PostException(ErrorCode.POST_NOT_FOUND)` → `404` / `POST_NOT_FOUND`
  - `PostException(ErrorCode.NOT_POST_AUTHOR)` → `403` / `NOT_POST_AUTHOR`
  - `MethodArgumentNotValidException` → `400` / `VALIDATION_FAILED`（带 `error.details`）

### D8. 分页
controller 接收 `page`(默认0)/`size`(默认20)，在调用 service 前将 `size` 上限钳制为 50（`Math.min(size, 50)`），再构造 `Pageable`。

### D9. Schema 供给
`posts` 表创建沿用 `users` 表既有供给机制（Hibernate ddl-auto 或既有迁移脚本），不引入新的迁移体系。

### D10. API 契约
controller 以 springdoc 注解描述；实现后重新生成 `/v3/api-docs`，更新前端 `openapi.json` 进仓快照（见 project.md API 契约），使 `hot-posts` 等前端 change 可基于类型层消费。

## Risks / Trade-offs

- **[作者 N+1]** → 已通过 D4 批量 IN 查询缓解（每页 1 次额外查询，非每行）。
- **[Markdown 剥离不完美]** → 仅用于列表卡片摘要，不影响数据正确性；后续可升级为完整解析器而不改契约。
- **[content XSS]** → 后端按用户决策存储**原始 Markdown**，`content` 原样返回；净化责任在前端渲染层。若未来后端 SSR 渲染，必须在此处加 sanitize（Risk 升级，需新 change）。
- **[作者已软删]** → D4 回退占位文案，且不泄露隐私字段。
- **[size 上限被绕过]** → 钳制在 controller/service 边界，单测覆盖 `size=200→50`。
- **[标签大小写/空白重复]** → D3 归一化处理。
