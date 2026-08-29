## 1. 数据模型与仓库

- [ ] 1.1 创建 `posts/domain/Post.java`：继承 `BaseEntity`，类级 `@SQLRestriction("deleted_at IS NULL")`；字段 `authorId`(UUID)、`title`(≤200)、`content`、`coverImageUrl`、`status`(`@Enumerated(STRING)` + `PostStatus` 枚举 DRAFT/PUBLISHED)、`@ElementCollection` `tags`（连接表 `post_tags`）；工厂方法注入 `id/now`（同 BaseEntity 约定）。
- [ ] 1.2 创建 `posts/repository/PostRepository.java`：继承 `JpaRepository<Post, UUID>`，提供 `findByStatus(Pageable)`、`findByAuthorId(UUID, Pageable)`、默认 `findById`；列表默认按 `created_at` 倒序。

## 2. DTO 与派生工具

- [ ] 2.1 创建请求 DTO（record）：`CreatePostRequest`（`@NotBlank` title/content、`@Size` tags、`@Pattern` coverImageUrl 形态、可选 `status` 缺省 DRAFT）、`UpdatePostRequest`（同字段可空，含 `status`）。
- [ ] 2.2 创建响应 DTO（class extends `BaseResponse`）：`PostResponse` / `PostSummary`，字段 `private final` + `@JsonProperty("snake_case")`，白名单严格按 spec（不含 `deletedAt`）；`authorName` / `authorAvatarUrl` 字段。
- [ ] 2.3 创建 `MarkdownSummary.derive(content, max=160)` 纯函数：剥离 Markdown 语法 → 折叠空白 → 取前 160 字符（中文按 code point）。

## 3. 异常与错误码

- [ ] 3.1 新增 `PostNotFoundException`（`404 POST_NOT_FOUND`）、`NotPostAuthorException`（`403 NOT_POST_AUTHOR`）；在 `GlobalExceptionHandler` 注册映射（复用统一错误信封）。

## 4. Service 层

- [ ] 4.1 创建 `posts/service/PostService.java`（构造器注入）：`create`（authorId 取自入参/JWT sub、tag 归一化 trim+lowercase）、`listPublished`（分页、size 钳制 50、批量 IN 解析作者 displayName/avatarUrl，作者缺失回退占位）、`getPublished`（非 PUBLISHED/已软删抛 `PostNotFoundException`）、`update`（校验作者身份否则 `NotPostAuthorException`）、`listMine`（按 authorId 取全部状态）。
- [ ] 4.2 在 service 内将 `summary` 通过 `MarkdownSummary` 派生注入 DTO（不存储）。

## 5. Controller 层

- [ ] 5.1 创建 `posts/controller/PostsController.java`：`POST /api/posts`（需鉴权，丢弃请求体 `authorId`，以 JWT `sub` 覆盖）、`GET /api/posts`（公开、仅 PUBLISHED、分页）、`GET /api/posts/{id}`（公开详情）、`PUT /api/posts/{id}`（需鉴权 + 作者校验）、`GET /api/posts/me`（需鉴权）。分页 `size` 上限钳制为 50。

## 6. 测试（TDD，须全绿）

- [ ] 6.1 实体/仓库测试：`Post` 落库与 `@SQLRestriction` 软删过滤；tags 归一化存储。
- [ ] 6.2 Service 单元测试（mock repository）：create 忽略客户端 authorId、tag 归一化、列表仅 PUBLISHED、作者缺失回退、update 非作者抛 `NotPostAuthorException`、`listMine` 含 DRAFT。
- [ ] 6.3 Controller `@WebMvcTest` 切片测试：覆盖 `201` 创建、`401 UNAUTHENTICATED`（无令牌）、`403 NOT_POST_AUTHOR`、`404 POST_NOT_FOUND`（草稿/已删）、列表仅 PUBLISHED、`size=200→50` 钳制、`summary` 派生、作者信息展示。
- [ ] 6.4 安全边界测试：详情/列表响应 JSON 不含 `deleted_at` / 作者 `email`。

## 7. API 契约与收尾

- [ ] 7.1 为 controller 加 springdoc 注解；重新生成 `/v3/api-docs` 并更新前端 `openapi.json` 进仓快照（`npm run openapi:sync`）。
- [ ] 7.2 后端 `mvn` 编译 + 全量测试绿灯（主分支测试始终绿灯）。
