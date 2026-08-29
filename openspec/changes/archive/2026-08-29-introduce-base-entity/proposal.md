# Proposal: 引入 BaseEntity 统一数据模型公共字段

## What Changes

### 背景与动机

- 当前仓库唯一实体 `User`（`auth/domain/User.java`）自带 `id`(UUID) / `createdAt` / `updatedAt` / `deletedAt` 字段及对应 getter，且时间戳由**领域方法显式传入 `Instant now`** 管理（刻意的可测性设计，非 `@PrePersist`/`@PreUpdate`）。
- `backend-conventions.md` 已声明「entity 继承 BaseEntity」，但 `BaseEntity` 尚不存在，`User` 也未继承，文档与代码不一致。
- 业务模块（行程 / 景点 / 评论等）即将开发，需先确立统一公共字段模式，避免每个实体重复样板、各自为政。

### 模块边界（Out of Scope）

- ❌ 不新增任何业务功能 / API / 端点
- ❌ 不引入 `@PrePersist`/`@PreUpdate` 隐式时钟（保留显式 `now` 注入，保障可测性）
- ❌ 不改动 `User` 的业务行为（注册 / 验证 / 锁定 / 软删语义完全不变，仅结构继承）
- ❌ 不替换现有持久化方案（仍 Spring Boot 3.3 + Spring Data JPA + H2）
- ❌ 不为 `BaseEntity` 引入乐观锁 `@Version`（YAGNI，后续按需）
- ❌ 不重构除 `User` 外的其他模块（`User` 是既有唯一实体）

### 后端变更

- 新增 `com.mooc.backend.common.BaseEntity`（`@MappedSuperclass`）：`id`(UUID) + `createdAt` + `updatedAt` + `deletedAt` + `touch(Instant)` + `equals`/`hashCode`
- 重构 `User` 继承 `BaseEntity`：删除重复字段与 getter，构造器改 `super(id, now)`、领域方法改 `this.touch(now)`；修正 `setDisplayName`/`setAvatarUrl` 使用 `Instant.now()`（真时钟）的瑕疵，统一为 `this.touch(Instant.now())`
- 软删除标记 `deletedAt` 留在基类；`@SQLRestriction` 改为各实体**按需声明**（`User` 因鉴权需读已删行而故意不声明），避免破坏 `ACCOUNT_DELETED` / 令牌即时失效语义
- 同步更新 `backend-conventions.md`：陈旧的 `entity/` 单层描述改为真实 `feature/domain` 结构 + 新增 `common/` 共享内核说明

### 规格变更

- 新增 `openspec/specs/backend-data-model.md`（引入即落地，置于本 change 的 `specs/` delta）

## 已决决策（Open Questions 已全部确认）

- [x] **时间戳机制**：显式 `now` 注入（方案 A），不使用 JPA 生命周期回调
- [x] **软删除位置**：进 `BaseEntity`（方案 X），统一 `@SQLRestriction`
- [x] **是否重构 User**：是，让 `User` 继承 `BaseEntity` 并修复时钟来源不一致 bug
- [x] **包位置**：`com.mooc.backend.common`，并同步改规约文档
