## Why

`database-conventions.md`（always-on 约束）明确规定软删除使用 `boolean deleted` 字段 + `isDeleted()` / `markDeleted()` 访问器 + 查询层 `findByXxxAndDeletedFalse` 显式过滤。但在 `introduce-posts-module` change 实现时，代码偏离了该约束，改用 `Instant deletedAt` + `@SQLRestriction("deleted_at IS NULL")`，并连带把 `posts/spec.md` 写成了 `deleted_at` 语义。

用户已恢复 `database-conventions.md` 为权威约束。本 change 将已实现的 `BaseEntity` / `User` / `Post` 及相关测试、spec 对齐回该约束，恢复"约束为真相来源"的一致性。

## What Changes

- **`BaseEntity`**：将 `Instant deletedAt` 字段改为 `boolean deleted`（`@Column(nullable = false)`，默认 `false`）；移除 `getDeletedAt()`，新增 `isDeleted()` 与 `markDeleted()`（不暴露 `setDeleted(boolean)`）。
- **`User.softDelete(Instant now)`**：将 `this.deletedAt = now` 改为调用 `markDeleted()`（保留 status / verificationCode 清理逻辑）。
- **`Post`**：移除 `@SQLRestriction("deleted_at IS NULL")` 注解及 `org.hibernate.annotations.SQLRestriction` import；更新类注释。
- **`PostRepository`**：查询方法改为显式过滤——
  - `findByStatus` → `findByStatusAndDeletedFalse`
  - `findByAuthorId` → `findByAuthorIdAndDeletedFalse`
  - 新增 `findByIdAndDeletedFalse`（替代原先靠 `@SQLRestriction` 在 `findById` 上隐式过滤的行为，保住"软删行 404"语义）。
- **`PostService`**：调用改为上述新方法（`listPublished` / `getPublished` / `update` / `listMine` 行为不变：软删行仍 404 / 不出现在列表）。
- **测试对齐**：所有 `getDeletedAt()` / `deleted_at` 断言改写；`PostRepositoryTest` 原生 `UPDATE posts SET deleted_at = ?` 改为 `SET deleted = true`；序列化测试断言不含 `deleted` / `deleted_at` / `deletedAt`。
- **`posts/spec.md`**：Requirement「帖子数据模型」中 `deleted_at` 表述改为 `deleted` 布尔 + 显式查询过滤，与约束一致。
- **不改 `database-conventions.md` 本身**（它是真相来源）。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `posts`：数据模型与软删语义对齐 `database-conventions`
- `auth-module`：仅 `User.softDelete` 内部字段名改动，对外行为不变

## Impact

- **数据库列**：`posts.deleted_at`（TIMESTAMP）→ `posts.deleted`（BOOLEAN，非空默认 false）；`users.deleted_at` → `users.deleted`。开发环境 H2 文件库 schema 需同步（`ddl-auto=update` 会自动加新列，旧 `deleted_at` 列需手动清理，见 design D5）。
- **`BaseEntity` 字段签名变更**：所有依赖 `getDeletedAt()` 的测试与代码需更新（见 tasks 测试清单）。
- **无新增端点，无 BREAKING API 变更**（响应体本就不含软删字段）。
- **前端无影响**：白名单 DTO 未暴露软删字段，`frontend/openapi.json` 契约字段不变。

## 不在本 change 范围（需单独决策）

- `database-conventions.md` 同时规定"开发环境用 MySQL 8，H2 仅 test scope"，但当前项目用 H2 文件库做 dev。这是另一处偏离，但属于基础设施迁移（需可用 MySQL 实例 + 连接配置），不在本次"软删对齐"内，列为独立 infra change。
- `backend-conventions.md` 的 `BaseResponse` 议题（Response DTO 是否继承基类）属独立 concern，本 change 不处理。
