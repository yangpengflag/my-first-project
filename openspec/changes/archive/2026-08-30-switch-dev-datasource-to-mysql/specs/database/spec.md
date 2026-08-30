# 开发环境数据源规格

## Requirement: 开发数据源使用 MySQL 8

后端开发 / 默认运行环境 SHALL 使用本地 MySQL 8 作为数据源，而非 H2。

### Scenario: 启动后端连接 MySQL
- **WHEN** 开发者启动后端（默认 profile）
- **THEN** 通过 `jdbc:mysql://localhost:3306/wanderchina` 连接本地 MySQL 8
- **AND** 数据库字符集为 `utf8mb4`

### Scenario: 表结构同步
- **WHEN** 应用以 `ddl-auto=update` 启动
- **THEN** Hibernate 按当前 JPA 实体重建 / 同步 `users`、`posts` 等表
- **AND** 不丢弃既有数据（仅同步结构变更）

### Scenario: 测试需要 MySQL
- **WHEN** 开发者执行 `mvn test`
- **THEN** 测试直连同一 MySQL 实例（H2 已移除）
- **AND** 须先确保 MySQL 在线且 `wanderchina` 库已存在

## Requirement: H2 不进入主依赖

H2 SHALL NOT 出现在主运行时依赖中。本 change 选择完全移除 H2；如后续需要测试数据隔离，可仅以 `test` scope 引入（非本次范围）。
