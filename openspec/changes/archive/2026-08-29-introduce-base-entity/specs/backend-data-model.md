## ADDED Requirements

### Requirement: 实体公共基类 BaseEntity

所有 JPA 实体 SHALL 继承 `com.mooc.backend.common.BaseEntity`（`@MappedSuperclass`），不得各自重复定义主键与时间戳字段。

### Requirement: 公共字段构成

BaseEntity SHALL 提供以下字段：

- `id`：`UUID`，主键，`@Id`，`nullable=false` 且 `updatable=false`，由子类工厂在构造期以 `UUID.randomUUID()` 赋值
- `createdAt`：`Instant`，`@Column(name="created_at", nullable=false, updatable=false)`，构造期赋值后不可变
- `updatedAt`：`Instant`，`@Column(name="updated_at", nullable=false)`，每次业务变更后刷新
- `deletedAt`：`Instant`，`@Column(name="deleted_at")`，可空，软删除标记

#### Scenario: 新实体继承后自动具备公共字段

- **GIVEN** 一个继承 `BaseEntity` 的实体（如未来的 `Itinerary`）
- **WHEN** 通过工厂方法以 `(id, now)` 创建
- **THEN** 其实例具备非空 `id`、`createdAt == now`、`updatedAt == now`、`deletedAt` 为 `null`

### Requirement: 时间戳显式注入

实体 SHALL 通过显式传入的 `Instant now` 管理 `createdAt` / `updatedAt`，SHALL NOT 依赖 `@PrePersist` / `@PreUpdate` 配合隐藏时钟。BaseEntity SHALL 提供 `protected void touch(Instant now)` 供子类在业务变更末尾刷新 `updatedAt`。

#### Scenario: 构造期设定双时间戳

- **GIVEN** 调用子类工厂 `create(x, now)`
- **THEN** 构造出的实体 `createdAt == now` 且 `updatedAt == now`

#### Scenario: 业务变更刷新 updatedAt

- **GIVEN** 实体创建于 `t0`
- **WHEN** 在 `t1` 调用某业务变更方法（内部调 `touch(t1)`）
- **THEN** 该实体 `updatedAt == t1` 且 `createdAt` 仍为 `t0`

#### Scenario: 不使用 JPA 生命周期回调

- **GIVEN** 任何实体
- **THEN** 其代码中不包含 `@PrePersist` / `@PreUpdate` 注解

### Requirement: 软删除标记与按需过滤

BaseEntity SHALL 携带 `deletedAt` 字段（软删除标记）。自动过滤已删行的 `@SQLRestriction("deleted_at IS NULL")` SHALL 由各实体在**自身类上按需声明**，而非统一置于基类——因为 `User` 的鉴权逻辑（登录、`UserStatusFilter` 令牌校验）必须能查到已软删的行以返回精确的 `ACCOUNT_DELETED` 响应，基类全局过滤会破坏该语义。`User` SHALL 故意不声明该限制。

#### Scenario: 需要过滤的实体默认隐藏已删行

- **GIVEN** 一个声明了 `@SQLRestriction("deleted_at IS NULL")` 的实体（如未来的 `Itinerary`）
- **WHEN** 通过 `JpaRepository` 的 `find*` / `findAll` 查询
- **THEN** 结果中不包含 `deletedAt` 非空的行

#### Scenario: User 仍可查询到已删行（鉴权需要）

- **GIVEN** `User` 未声明 `@SQLRestriction`
- **WHEN** 通过 `userRepository.findByEmail(...)` / `findById(...)` 查询已软删用户
- **THEN** 仍能命中该行，供 `UserStatusFilter` 返回 `ACCOUNT_DELETED` / 令牌即时失效

#### Scenario: 显式绕过过滤

- **WHEN** 通过 `@Query(nativeQuery=true)` 或底层 `EntityManager` 显式查询
- **THEN** 可读取到含 `deletedAt` 的行（用于审计 / 恢复）

### Requirement: 实体相等性按主键

BaseEntity SHALL 以 `id`（UUID）定义 `equals` / `hashCode`，并 SHALL 使用 `getClass()` 进行类型校验，防止不同实体类型实例因 `id` 偶然相等而被判等。

#### Scenario: 同类型同 id 相等

- **GIVEN** 两个 `User` 实例 `id` 相同
- **THEN** 二者 `equals` 为 `true`，`hashCode` 相同

#### Scenario: 不同类型不判等

- **GIVEN** 一个 `User` 与一个 `Itinerary`，`id` 相同（UUID 实际上不会碰撞）
- **THEN** 二者 `equals` 为 `false`

### Requirement: 共享内核包位置与规约同步

`BaseEntity` SHALL 位于 `com.mooc.backend.common` 包（跨 feature 共享内核）；`backend-conventions.md` SHALL 以真实 `feature/domain` 分层描述取代陈旧的 `entity/` 单层描述，并补充 `common/` 说明。

#### Scenario: BaseEntity 包路径

- **WHEN** 在任意 feature 模块中引用
- **THEN** import 路径为 `com.mooc.backend.common.BaseEntity`

#### Scenario: 规约文档与代码一致

- **GIVEN** 更新后的 `backend-conventions.md`
- **THEN** 文档描述的实体包结构与实际 `auth/domain/`、`common/` 一致，不再出现不存在的 `entity/` 顶层包
