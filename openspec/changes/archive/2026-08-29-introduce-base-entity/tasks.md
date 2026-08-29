# 施工排期：引入 BaseEntity 统一数据模型公共字段

> TDD 约束：先写失败测试（红），再实现（绿），最后按需重构。

## 后端任务

### 1. 编写 BaseEntity 单元测试（TDD 红）
- **文件**: `backend/src/test/java/com/mooc/backend/common/BaseEntityTest.java`
- **操作**: 覆盖 `createdAt`/`updatedAt` 初始化、`touch` 刷新、`equals`/`hashCode` 按 `id` + `getClass()`、`@SQLRestriction` 查询过滤（集成或更轻量的结构断言）
- **验证**: 初始编译失败（`BaseEntity` 不存在）→ 实现后转绿

### 2. 新增 BaseEntity
- **文件**: `backend/src/main/java/com/mooc/backend/common/BaseEntity.java`
- **操作**: 创建 `@MappedSuperclass`，含 `id`/`createdAt`/`updatedAt`/`deletedAt` + `touch` + `equals`/`hashCode` + `@SQLRestriction("deleted_at IS NULL")`
- **验证**: `mvn test`（BaseEntityTest）通过

### 3. 重构 User 继承 BaseEntity
- **文件**: `backend/src/main/java/com/mooc/backend/auth/domain/User.java`
- **操作**: 删除重复字段 / getter；构造器改 `super(id, now)`；领域方法改 `this.touch(now)`；`setDisplayName`/`setAvatarUrl` 改 `this.touch(Instant.now())`
- **验证**: `mvn compile` 通过；`User` 仍 `extends BaseEntity`

### 4. 跑通既有 User / Auth 测试（行为无回归）
- **操作**: 运行 `UserTest`、`AuthServiceRegistrationTest`、`UserResponseSerializationTest`
- **验证**: 全部通过（序列化白名单键集 `{id, email, displayName, avatarUrl, status, createdAt}` 不变，软删语义不变）

### 5. 同步更新后端编码规约
- **文件**: `.codebuddy/rules/backend-conventions.md`
- **操作**: 将 `entity/ ← JPA 实体：继承 BaseEntity` 改为真实 `feature/domain` 结构说明，并新增 `common/ ← 跨模块共享内核（BaseEntity 等）`
- **验证**: 文档与代码结构一致，不再出现不存在的 `entity/` 顶层包

## 后续

- [ ] 归档变更 `introduce-base-entity`
- [ ] 将 `specs/` delta 合并入 `openspec/specs/backend-data-model.md`
- [ ] 更新 `openspec/project.md`（提及共享内核 `BaseEntity`）
- [ ] 业务模块（行程 / 景点）change 直接复用 `BaseEntity`
