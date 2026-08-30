## 1. 数据模型

- [ ] 1.1 `Post.java`：`tags` 改 `@JdbcTypeCode(SqlTypes.JSON)` 单 `tags` 列；新增 `softDelete(Instant)`（复用 `markDeleted()` + `touch(now)`）。

## 2. Service / Controller

- [ ] 2.1 `PostService.delete(id, authorId, now)`：404 / 403 / 软删保存。
- [ ] 2.2 `PostsController`：`DELETE /api/posts/{id}`，返回 `204`，复用 `currentUserId()`。

## 3. 测试（TDD，须全绿）

- [ ] 3.1 `PostServiceTest` 增删测试；`PostsControllerIntegrationTest` 增删流程测试。
- [ ] 3.2 删 `backend/data/wanderchina*` 后 `mvn test` 全绿（posts 包为主）。

## 4. API 契约

- [ ] 4.1 起后端(8080) → `openapi:sync` → `openapi:gen` → `openapi:drift` 通过；提交 frontend 快照。

## 5. 收尾

- [ ] 5.1 后端 commit；父仓 bump 子模块指针；（按需）push。
