# 技术设计：引入 BaseEntity 统一数据模型公共字段

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│  com.mooc.backend.common.BaseEntity  (@MappedSuperclass)       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ id: UUID          @Id  (构造期 UUID.randomUUID())       │  │
│  │ createdAt: Instant @Column(updatable=false)             │  │
│  │ updatedAt: Instant @Column                              │  │
│  │ deletedAt: Instant @Column  (软删标记，过滤由实体按需声明) │  │
│  │ touch(Instant now) / equals / hashCode                 │  │
│  └────────────────────────────────────────────────────────┘  │
│        ▲ extends                  ▲ extends (未来)             │
│        │                           │                            │
│  ┌─────────────┐          ┌──────────────┐  ┌──────────────┐  │
│  │ auth.domain │          │ itinerary.   │  │ attraction.  │  │
│  │   .User     │          │   .Itinerary │  │  .Attraction │  │
│  └─────────────┘          └──────────────┘  └──────────────┘  │
│                                                              │
│  (可选) SimpleEntity (id + 时间戳，无 deletedAt) → 字典类     │
└──────────────────────────────────────────────────────────────┘
   软删过滤由各实体按需声明 @SQLRestriction("deleted_at IS NULL")；
   User 因鉴权需读已删行而故意不声明
```

## 技术决策

| 决策项 | 选择 | 理由 | 替代方案 |
|--------|------|------|----------|
| 时间戳管理 | 显式 `now` 注入 + `BaseEntity.touch(now)` | 与现有 `User` 设计一致；测试可注入确定时间，不依赖真实时钟 | `@PrePersist`/`@PreUpdate` + 隐藏时钟 |
| 软删除 | `deletedAt` 进 `BaseEntity`；`@SQLRestriction` 由实体**按需声明** | `User` 鉴权须查到已删行（`UserStatusFilter`/`findByEmail` 依赖），基类全局过滤会破坏 `ACCOUNT_DELETED` / 令牌即时失效语义 | 基类全局 `@SQLRestriction`（已否，见风险） |
| 基类机制 | `@MappedSuperclass` | 字段映射到子类表，无独立基类表，最简单 | `@Inheritance` 单表/ joined |
| 标识 / 相等 | `equals`/`hashCode` 按 `id` + `getClass()` | UUID 构造即赋值，id 永非空；`getClass()` 防跨类型误等 | `instanceof` / 业务键 |
| 包位置 | `com.mooc.backend.common` | 跨 feature 共享内核，贴合真实结构 | `entity/`（与现状不符，文档陈旧） |
| ID 生成 | 子类工厂显式 `UUID.randomUUID()` | 维持现状，id 在构造期确定 | `@GeneratedValue` |

## 数据结构

### `BaseEntity`

| 字段 | 类型 | 注解 | 约束 |
|------|------|------|------|
| `id` | `UUID` | `@Id`, `@Column(nullable=false, updatable=false)` | 构造期由子类 `UUID.randomUUID()` 赋值 |
| `createdAt` | `Instant` | `@Column(name="created_at", nullable=false, updatable=false)` | 构造期 = `now`，之后不可变 |
| `updatedAt` | `Instant` | `@Column(name="updated_at", nullable=false)` | 每次业务变更经 `touch(now)` 刷新 |
| `deletedAt` | `Instant` | `@Column(name="deleted_at")` | 软删除标记，可空（过滤由实体按需声明 `@SQLRestriction`） |

### 关键方法

- `protected BaseEntity()` — JPA 反序列化无参构造
- `protected BaseEntity(UUID id, Instant now)` — 业务构造，设定 `id` / `createdAt` / `updatedAt`
- `protected void touch(Instant now)` — 子类领域方法变更末尾调用，刷新 `updatedAt`
- `getId()` / `getCreatedAt()` / `getUpdatedAt()` / `getDeletedAt()` — 只读访问器
- `equals` / `hashCode` — 按 `id`（`getClass()` 类型校验，防 `User` 与 `Itinerary` 误等）

### `User` 改造对照

| 改造前 | 改造后 |
|--------|--------|
| 自有 `id`/`createdAt`/`updatedAt`/`deletedAt` 字段 + getter | 继承 `BaseEntity`，字段 / getter 删除 |
| 私有构造器手写 `this.createdAt=now; this.updatedAt=now` | `super(id, now)` |
| 各领域方法 `this.updatedAt = now` | `this.touch(now)` |
| `setDisplayName`/`setAvatarUrl` 用 `Instant.now()`（真时钟） | `this.touch(Instant.now())`（统一时钟来源） |

`User` 的工厂 `register(rawEmail, passwordHash, displayName, now)` 改为 `super(UUID.randomUUID(), now)`；`equals`/`hashCode` 上提至基类（由 `instanceof User` 变为 `getClass()` 校验）。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| `@SQLRestriction` 作用域 | 若置于基类会过滤掉 `User` 已删行，破坏鉴权（ACCOUNT_DELETED / 令牌即时失效） | 改由各实体按需声明；`User` 明确不声明；新增业务实体在 design 中显式加 `@SQLRestriction("deleted_at IS NULL")` |
| `equals` 提升至基类改变 `User` 相等语义 | 既有 `UserTest` 由 `instanceof` 变为 `getClass` | 补充 `BaseEntityTest` 相等性单测；跑通既有 `UserTest` / `AuthServiceRegistrationTest` |
| 规约文档改动引发混淆 | 后续开发者按旧文档找 `entity/` | 文档改为 `domain/` + `common/`，并在本 change 内同步 |
| 乐观锁缺失 | 并发更新可能丢失 | 本期 YAGNI，后续业务模块若需再评估 `@Version` |
