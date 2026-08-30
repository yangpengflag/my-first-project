## Why

backend 当前使用 H2 文件库（`jdbc:h2:file:./data/wanderchina`）作为主数据源，与 `database-conventions` 第 6、70–74 行既定目标（开发环境用 MySQL 8，H2 仅 test scope）不符；同时也无法在本地复现真实的 MySQL 方言行为（`binary(16)` 存 UUID、`utf8mb4`、枚举 STRING 列、`tags` JSON 列等）。本 change 将主数据源切换为本地 MySQL 8，使实现与规约一致，并为后续 PostgreSQL / Flyway 迁移打好基础。

## What Changes

- `pom.xml`：移除 `com.h2database:h2` 依赖；新增 `com.mysql:mysql-connector-j`（`runtime` scope，版本由 Spring Boot BOM 管理）。
- `application.yml`：
  - `spring.datasource` 改为 MySQL 8：`url` 指向 `jdbc:mysql://localhost:3306/wanderchina`（含 utf8mb4 / UTC 时区 / 本地 dev 参数）、`driver-class-name: com.mysql.cj.jdbc.Driver`、`username: root` / `password: "123456"`。
  - `jpa.hibernate.ddl-auto` 保持 `update`（保留数据，仅同步结构变更）。
  - 移除 `spring.h2.console` 配置块。
- 新增 `specs/database` capability，将开发数据源契约固化（MySQL 8 / utf8mb4 / ddl-auto update / H2 移除）。

## 不变

- 实体层无需改动：`BaseEntity` 主键为应用注入的 UUID（无 `@GeneratedValue`），`User` / `Post` 已遵守 snake_case 表名与 `@Enumerated(STRING)`；唯一一处 native query（`PostRepositoryTest` 的 `UPDATE posts SET deleted = true WHERE id = ?1`）使用真实表/列名，对 H2 与 MySQL 均兼容。
- `ddl-auto=update` 下，首次启动按当前实体重建 `users` / `posts` 表（含 `uk_users_email`、`tags` JSON 列等）。

## 风险 / 前提

- **移除 H2 后 `mvn test` 必须连 MySQL**：不再有 H2 兜底，本地须先启动 MySQL 8（3306）且存在 `wanderchina` 库，测试才能跑（沿用主数据源）。
- **已有 H2 文件库数据不迁移**：切到全新 MySQL 后库为空；`ddl-auto=update` 的"保留数据"指重启不丢，不指 H2→MySQL 迁移。旧 `backend/data/wanderchina.mv.db` 可删。
- **环境前提**：本机已安装并运行 MySQL 8（用户确认 `root` / `123456` 可用）。

## Capabilities

### New Capabilities

- `database`：开发环境数据源契约（MySQL 8 / utf8mb4 / ddl-auto update / H2 移除）。

### Modified Capabilities

- 无。

## Impact

- 文件：`backend/pom.xml`、`backend/src/main/resources/application.yml`、新增 `openspec/specs/database/spec.md`。
- 运行前提：开发者机器需本地 MySQL 8 + `wanderchina`(utf8mb4) 库。
- 无 API 契约变更（data 层对外契约不变），无需重新生成前端 `openapi` 快照或跑 `openapi:drift`。
