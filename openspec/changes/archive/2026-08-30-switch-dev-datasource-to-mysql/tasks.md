## 1. 依赖与配置

- [x] 1.1 `pom.xml`：移除 `com.h2database:h2`；新增 `com.mysql:mysql-connector-j`（`runtime`）。
- [x] 1.2 `application.yml`：`spring.datasource` 改为 MySQL 8（url/driver/username=root/password=123456）；保留 `ddl-auto: update`；删除 `spring.h2.console` 块。

## 2. MySQL 准备

- [x] 2.1 执行 `CREATE DATABASE wanderchina CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`（MySQL 不会自动建库，必须手动）。
- [x] 2.2 （可选）删除废弃的 `backend/data/` H2 文件库。
- [x] 2.3 首次 `mvn test` / 起后端后，确认 `users`、`posts` 表已由 Hibernate `ddl-auto=update` 自动生成：
  `mysql -uroot -p123456 -e "USE wanderchina; SHOW TABLES;"`（应见 `users`、`posts`）。

## 3. 验证（须全绿）

- [x] 3.1 `mvn test` 全绿（182 tests, 0 failures, 0 errors；MySQL 在线，`root`/`123456` 可连 `wanderchina`）。
- [x] 3.2 起后端(8080)验证：由 `AuthFlowIntegrationTest` / `PostsControllerIntegrationTest` 等集成测试在 MySQL 上全绿覆盖（注册 / 登录 / 发帖 + `/v3/api-docs` 生成）。

## 4. 收尾

- [x] 4.1 提交 backend 子仓；父仓 bump 子模块指针；（按需）push。
