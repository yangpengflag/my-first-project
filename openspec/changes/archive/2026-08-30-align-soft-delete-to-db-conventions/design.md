## Context

- `backend` 为 Maven 单模块 Spring Boot 3.5（Java 17），标准分层（`controller → service → repository`，不可反向）。
- 当前 `BaseEntity`（`common/BaseEntity.java`）用 `Instant deletedAt` + 业务实体 `@SQLRestriction("deleted_at IS NULL")` 实现软删，偏离 `database-conventions.md` 的 `boolean deleted` + 查询层过滤约定。
- `User.softDelete`（`auth/domain/User.java:255`）写入 `this.deletedAt = now`；`Post`（`posts/domain/Post.java:33`）声明 `@SQLRestriction("deleted_at IS NULL")`；`PostRepository` 的 `findByStatus` / `findByAuthorId` 与 `PostService` 的 `findById` 均依赖该注解隐式过滤。
- 用户已恢复 `database-conventions.md` 为权威；本 change 让代码回归约束。

## Goals / Non-Goals

**Goals:**

- `BaseEntity` / `User` / `Post` 软删表示对齐 `boolean deleted` 约定。
- 过滤语义对齐：`findByXxxAndDeletedFalse` 显式过滤（Post）；`User` 鉴权查询仍须能命中已删行（不加过滤）。
- 测试与 `posts/spec.md` 同步对齐约束。

**Non-Goals:**

- 不改动 `database-conventions.md`（它是真相来源）。
- 不引入物理删除 / 不暴露 DELETE 端点（仍 Non-Goal，同原 posts change）。
- 不切换数据库引擎（MySQL dev vs H2 dev 见 D5，本 change 不处理，列为独立 infra change）。
- 不处理 `backend-conventions` 的 `BaseResponse` 议题（独立 concern）。

## Decisions

### D1. 字段表示：`boolean deleted` 替代 `Instant deletedAt`

`BaseEntity` 将 `protected Instant deletedAt` 改为 `private boolean deleted = false;`（带 `@Column(nullable = false)`）。理由：遵约束；布尔标志更简单，且约束未要求保留删除时间戳。

### D2. 访问器：`isDeleted()` / `markDeleted()`

移除 `getDeletedAt()`；新增 `public boolean isDeleted()`（返回 `deleted`）与 `public void markDeleted()`（置 `deleted = true`，无参）。`User.softDelete(Instant now)` 内部改调 `markDeleted()`，并保留 `status = DELETED`、清空 `verificationCode` 等逻辑（见 `User.java:255-261`）。

### D3. 过滤方式：查询层 `findByXxxAndDeletedFalse`，移除 `@SQLRestriction`

`Post` 移除 `@SQLRestriction` 注解与 import。`PostRepository` 改为：

```java
Page<Post> findByStatusAndDeletedFalse(PostStatus status, Pageable pageable);
Page<Post> findByAuthorIdAndDeletedFalse(UUID authorId, Pageable pageable);
Optional<Post> findByIdAndDeletedFalse(UUID id);
```

`PostService` 调用点（`PostService.java:72, 85, 97, 118`）逐一改为上述方法，确保行为不变：列表仅含未删、详情/编辑对软删行仍 404。

- **备选**：保留 `@SQLRestriction("deleted = false")`（Hibernate 级全局过滤）→ **rejected**：约束第 68 行明确要求"查询层显式过滤 `findByXxxAndDeletedFalse`"，且全局过滤对 `User`（需查已删）有副作用；查询层过滤更贴合约定。

### D4. User 查询不加 `AndDeletedFalse`

`auth/domain/UserRepository` 的 `findByEmail` / `findById` 必须能找到已删用户以返回 `ACCOUNT_DELETED`，故**保持不过滤**；`findAllById`（作者解析，`PostService.java:165`）亦不过滤，由 `resolveAuthors` 按 `status == DELETED` 回退占位（`PostService.java:170`）。design 层面明确禁止给 auth 查询加 `AndDeletedFalse`，并在代码注释标注。

### D5. Schema 迁移：`deleted_at` → `deleted`

开发 H2 文件库（`backend/data/wanderchina`）通过 `ddl-auto=update` 自动加 `deleted` BOOLEAN 列；旧 `deleted_at` 列数据无业务逻辑依赖，但**不会被自动删除**。对策：在任务中标注手动清理步骤（如 `ALTER TABLE posts DROP COLUMN deleted_at; ALTER TABLE users DROP COLUMN deleted_at;`），或接受遗留空列（不影响正确性）。本 change 不引入 Flyway。

### D6. 测试对齐

受影响测试（见 tasks）：

- `BaseEntityTest:35` `getDeletedAt()` → `isDeleted()`
- `UserTest:40,184` / `AuthServiceDeletionTest:80` / `AuthServiceRegistrationTest:76` `getDeletedAt()` → `isDeleted()`，时间断言 `isEqualTo(t)` → `isTrue()`
- `PostRepositoryTest:41` 原生 `UPDATE posts SET deleted_at = ?` → `SET deleted = true`
- `PostResponseSerializationTest:49` / `PostsControllerIntegrationTest:123` 断言不含 `deleted` / `deleted_at` / `deletedAt`
- `UserResponseSerializationTest:69` 黑名单集合补充 `deleted`

## Risks / Trade-offs

- **[删除时间戳丢失]** 原 `deletedAt` 携带删除时刻，改布尔后丢失该审计信息。约束未要求保留 → 接受（若未来需审计可另加列，但本 change 遵循约束不引入）。
- **[查询层遗漏]** 移除 `@SQLRestriction` 后，任何未加 `AndDeletedFalse` 的 Post 查询都会漏掉过滤。对策：Post 的全部查询方法均加后缀；`PostService` 四处调用点逐一核对（tasks 列出）。
- **[H2 schema 残留]** `deleted_at` 旧列不会被自动删除。对策：任务中标注清理命令。
- **[UserRepository 误加过滤]** 风险：有人给 auth 查询加 `AndDeletedFalse` 导致已删用户查不到。对策：D4 明确禁止并在代码注释标注。
