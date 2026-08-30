# Tasks — align-soft-delete-to-db-conventions

> 遵循 spec-driven TDD：每个代码改动先写/改失败测试（RED），再改实现使其通过（GREEN），最后核对无回归（REFACTOR）。
> 所有改动落在 `backend/` 子仓；完成后需在子仓提交并更新父仓指针。

## 1. 对齐 BaseEntity 软删字段

- [ ] 1.1 `common/BaseEntity.java`：将 `protected Instant deletedAt` 改为 `private boolean deleted = false;`（`@Column(nullable = false)`）。
- [ ] 1.2 移除 `getDeletedAt()`；新增 `public boolean isDeleted()` 与 `public void markDeleted()`（置 `deleted = true`，无参）。
- [ ] 1.3 更新类注释（19-23 行关于 `deletedAt` / `@SQLRestriction` 的描述 → `deleted` 布尔 + 查询层过滤）。

## 2. 对齐 User 软删写入

- [ ] 2.1 `auth/domain/User.java:255-261` `softDelete`：将 `this.deletedAt = now;` 改为 `this.markDeleted();`（保留 status / verificationCode 清理逻辑）。

## 3. 移除 Post 的 @SQLRestriction

- [ ] 3.1 `posts/domain/Post.java`：移除 `@SQLRestriction("deleted_at IS NULL")` 注解与 `import org.hibernate.annotations.SQLRestriction;`；更新类注释（26 行）中关于 `deleted_at` / `@SQLRestriction` 的描述。

## 4. PostRepository 查询层显式过滤

- [ ] 4.1 `posts/repository/PostRepository.java`：`findByStatus` → `findByStatusAndDeletedFalse`；`findByAuthorId` → `findByAuthorIdAndDeletedFalse`；新增 `findByIdAndDeletedFalse(UUID)`。
- [ ] 4.2 更新 `PostRepository` 类注释（移除 `@SQLRestriction` 相关表述）。

## 5. PostService 调用点对齐

- [ ] 5.1 `posts/service/PostService.java`：
  - `listPublished`（`PostService.java:72`）：`findByStatus(...)` → `findByStatusAndDeletedFalse(...)`
  - `getPublished`（`PostService.java:85`）：`findById(id)` → `findByIdAndDeletedFalse(id)`
  - `update`（`PostService.java:97`）：`findById(id)` → `findByIdAndDeletedFalse(id)`
  - `listMine`（`PostService.java:118`）：`findByAuthorId(...)` → `findByAuthorIdAndDeletedFalse(...)`
- [ ] 5.2 更新 `PostService` 注释（83、114 行中 `@SQLRestriction` 表述 → 查询层 `AndDeletedFalse`）。

## 6. 对齐 posts/spec.md

- [ ] 6.1 `openspec/specs/posts/spec.md` Requirement「帖子数据模型」：
  - 第 18 行 `@SQLRestriction("deleted_at IS NULL")` → 改为"查询层 `findByXxxAndDeletedFalse` 显式过滤软删"，并说明 `deleted` 布尔来自 `BaseEntity`。
  - 第 33、35 行 `deletedAt` / `deleted_at` 表述改为 `deleted` 布尔。

## 7. 测试对齐（TDD：先 RED 后 GREEN）

- [ ] 7.1 `common/BaseEntityTest.java:35`：`assertNull(d.getDeletedAt())` → `assertThat(d.isDeleted()).isFalse()`。
- [ ] 7.2 `auth/domain/UserTest.java:40,184`：`getDeletedAt()` 断言改为 `isDeleted()`（`isNull()` → `isFalse()`；`isEqualTo(t)` → `isTrue()`）。
- [ ] 7.3 `auth/service/AuthServiceDeletionTest.java:80`：`getDeletedAt().isEqualTo(...)` → `isDeleted().isTrue()`。
- [ ] 7.4 `auth/service/AuthServiceRegistrationTest.java:76`：`getDeletedAt().isNull()` → `isDeleted().isFalse()`。
- [ ] 7.5 `posts/repository/PostRepositoryTest.java`：
  - 第 22 行注释 `@SQLRestriction` 表述更新。
  - 第 41 行原生 `UPDATE posts SET deleted_at = ?1` → `UPDATE posts SET deleted = true`。
  - 新增/调整断言：验证 `findByStatusAndDeletedFalse` 排除软删行、`findByIdAndDeletedFalse` 对软删行返回空。
- [ ] 7.6 `posts/api/PostResponseSerializationTest.java:49` 与 `posts/api/PostsControllerIntegrationTest.java:123`：断言不含 `deleted` / `deleted_at` / `deletedAt`（补全 `deleted`）。
- [ ] 7.7 `auth/api/UserResponseSerializationTest.java:69`：黑名单集合补充 `deleted`（保持白名单护栏）。

## 8. Schema 清理（开发 H2 文件库）

- [ ] 8.1 在 `backend/data/wanderchina` H2 库执行（或于任务说明中标注）：`ALTER TABLE posts DROP COLUMN deleted_at; ALTER TABLE users DROP COLUMN deleted_at;`（确认 `ddl-auto=update` 已加 `deleted` BOOLEAN 列后再清理旧列）。
- [ ] 8.2 验证应用启动后 `posts` / `users` 表存在 `deleted` 列且默认 `false`。

## 9. 验证与交付

- [ ] 9.1 运行 `mvn test`（子仓）全量通过；核对无 `getDeletedAt` / `deleted_at` 残留引用。
- [ ] 9.2 （可选）起后端验证 `/v3/api-docs` 仍含 `/api/posts` 且字段无变化（`frontend/openapi.json` 契约不变，无需重新生成）。
- [ ] 9.3 在 `backend/` 子仓提交；按规约更新父仓 submodule 指针。

## 10. 待单独决策项（不在本 change）

- [ ] 10.1 数据库引擎：`database-conventions` 要求 dev 用 MySQL 8（H2 仅 test）。当前用 H2 文件库做 dev，属另一处偏离，需独立 infra change（提供 MySQL 实例 + 连接配置 + 迁移）。
- [ ] 10.2 `backend-conventions` 的 `BaseResponse` 议题独立处理。
