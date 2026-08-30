## Approach

### DELETE 端点（软删除）

- `PostsController.delete(@PathVariable UUID id)`：`currentUserId()` 取 JWT 主体（无主体抛 `UNAUTHENTICATED` → `401`）；调用 `PostService.delete(id, authorId, now)`；成功返回 `204 No Content`。
- `PostService.delete`：
  - `postRepository.findByIdAndDeletedFalse(id)` 缺失 → `PostException(POST_NOT_FOUND)`（`404`）
  - `!post.getAuthorId().equals(authorId)` → `PostException(NOT_POST_AUTHOR)`（`403`）
  - `post.softDelete(now)`（`markDeleted()` + `touch(now)`）→ `postRepository.save(post)`
- 软删除逻辑放在 `Post` 实体新方法 `softDelete(Instant)`，与现有 `update(Instant)` 同构（实体内调 `touch`，避免在 service 跨包调 `protected` 方法）。
- 鉴权复用 `AuthController` 模式：`SecurityContextHolder` 取 `authentication.getName()`（UUID 字符串），由 `JwtAuthFilter` 注入主体；`SecurityConfig` 的 `anyRequest().authenticated()` 已对 DELETE 兜底 `401`。

### tags JSON 列

- `Post.tags`：`@ElementCollection` + `@CollectionTable(post_tags)` + `@Column(tag)` → 替换为 `@JdbcTypeCode(SqlTypes.JSON)` + `@Column(name = "tags", nullable = false)`。
- `List<String>` 经 Hibernate 内置 JSON 绑定序列化；H2（测试）/ MySQL 8 / PostgreSQL 均支持 JSON 列，跨方言无显著差异。
- 移除不再使用的 import：`CollectionTable`、`ElementCollection`、`FetchType`、`JoinColumn`。
- 测试库：`backend/data/wanderchina*` 需删除让 Hibernate 按新实体重建 schema（避免 `post_tags` 残留 / `posts` 缺 `tags` 列）。

## Tests (TDD)

- 新增 `PostServiceTest`：`deleteRejectsNonAuthor`（非作者抛异常）、`deleteSoftRemovesFromQueries`（软删后 `isDeleted()==true`）。
- 新增 `PostsControllerIntegrationTest.deleteSoftRemovesPost`：匿名 → `401`、他人 → `403(NOT_POST_AUTHOR)`、作者 → `204`、随后 `GET` 详情 → `404`。
- `PostRepositoryTest.tagsPersistedAndLoaded` 保留（仍验证 `List<String>` 往返），注释更新为 JSON 列。

## API 契约

- 后端 `/v3/api-docs` 新增 DELETE 路径；执行 `npm run openapi:sync`（需后端 `8080` 运行）→ `npm run openapi:gen` 刷新 `frontend/lib/api.generated.ts`；跑 `npm run openapi:drift` 确认无漂移。
- 因仅新增端点、响应字段不变，`api.generated.ts` 仅多出 `deletePost` 类方法，既有消费点不受影响。

## 落库验证顺序

1. 改 `Post` / `PostService` / `PostsController` + 测试。
2. 删 `backend/data/wanderchina*` → `mvn test`（posts 包全绿）。
3. 起后端(8080) → `openapi:sync` → `openapi:gen` → `openapi:drift`。
4. 提交 backend；父仓 bump 子模块指针。
