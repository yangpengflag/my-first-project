## Approach

### 依赖（pom.xml）

- 删除 `com.h2database:h2` 整段 `<dependency>`（含 `<scope>runtime</scope>`）。
- 新增：
  ```xml
  <dependency>
      <groupId>com.mysql</groupId>
      <artifactId>mysql-connector-j</artifactId>
      <scope>runtime</scope>
  </dependency>
  ```
  （版本由 `spring-boot-starter-parent` BOM 管理，无需显式 `<version>`；Spring Boot 3.5 对应 Connector/J 8.x。）

### 数据源配置（application.yml）

- `spring.datasource` 整段替换为：
  ```yaml
  datasource:
    url: jdbc:mysql://localhost:3306/wanderchina?connectionTimeZone=UTC&useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true
    driver-class-name: com.mysql.cj.jdbc.Driver
    username: root
    password: "123456"
  ```
  - `connectionTimeZone=UTC`：保证 `Instant`(TIMESTAMP) 与 UTC 一致。
  - `characterEncoding=UTF-8`（Java 编码名；Connector/J 据此走 utf8mb4 线协议）+ 库级 utf8mb4：中文/emoji 正确存储。
  - `useSSL=false` + `allowPublicKeyRetrieval=true`：本地 dev 常用组合（MySQL 8 默认 `caching_sha2_password`，非 SSL 连接需允许公钥获取）。
- `jpa.hibernate.ddl-auto` 维持 `update`。
- 删除 `spring.h2.console` 整块。

### MySQL 准备

- `CREATE DATABASE wanderchina CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
- 账号 `root` / `123456` 需对该库有建表/改表权限（root 默认具备）。
- 可选清理：删除 `backend/data/`（H2 文件库已废弃）。

### 表结构由 Hibernate 自动预制（无需手写 DDL）

MySQL 不会自动建库，因此 `wanderchina` 库必须手动 `CREATE DATABASE`；但**表不需要手动建**。`jpa.hibernate.ddl-auto=update` 在应用 / 测试**首次启动**时，按 JPA 实体自动 `CREATE` 出下表（含约束），后续启动仅做结构同步：

- **`users`**（含 `BaseEntity` 公共列 + 实体列）：`id` binary(16) PK、`created_at`/`updated_at` timestamp、`deleted` boolean、`email`(unique，`uk_users_email`)、`password_hash`、`salt`、`display_name`、`avatar_url`、`status` varchar(32)（枚举 STRING）、`verification_code`、`verification_code_expires_at`、`failed_attempts` int、`locked_until`、`password_reset_code`、`password_reset_code_expires_at`、`password_changed_at`。
- **`posts`**：`id` binary(16) PK、`created_at`/`updated_at`/`deleted`、`author_id` binary(16)、`title` varchar(200)、`content` TEXT、`cover_image_url`、`status` varchar(16)（枚举 STRING）、`tags` JSON。

> 若希望表在**不启动应用**的情况下就确定性地存在（例如先 `SHOW TABLES` 检查 schema，或贴合后续 Flyway 迁移路线），可额外提供 `src/main/resources/schema.sql`（`CREATE TABLE IF NOT EXISTS`，`spring.sql.init.mode=always` + `spring.jpa.defer-datasource-initialization=true`）。本 change 默认**不**引入 schema.sql，避免与 Hibernate `update` 双源真理；如需请告知。

### UUID / 字符集细节（无需改实体）

- Hibernate 6 对 `UUID` 主键默认映射为 `binary(16)`，MySQL 8 支持，无需 `@Column(columnDefinition=...)`。
- `Instant` → `TIMESTAMP`；`connectionTimeZone=UTC` 保证与 UTC 一致。
- 库级 `utf8mb4` + 连接 `characterEncoding=UTF-8`（驱动据此走 utf8mb4 线协议）保证中文/emoji 正确存储。

## Tests

- 移除 H2 后 `mvn test` 直连 MySQL，须先满足环境前提。
- 现有 `BaseEntityTest` / `PostRepositoryTest` / `PostsControllerIntegrationTest` 等用例对数据源透明，预期在 MySQL 下仍全绿（含 UUID 主键往返、枚举 STRING、`tags` JSON 列、可移植的 native UPDATE）。
- 验证命令（见 memory：JAVA_HOME 须指向 JDK 17；字符集编码已写入 pom.xml 的 `maven.compiler.encoding`，无需命令行 -D 参数）：`mvn test`。

## 落库验证顺序

1. 改 `pom.xml` + `application.yml`；建 `wanderchina`(utf8mb4) 库。
2. `mvn test`（MySQL 在线）全绿。
3. 起后端(8080)，手动验证 `/v3/api-docs` 可达、注册/登录/发帖走通。
4. 提交 backend 子仓；父仓 bump 子模块指针。
