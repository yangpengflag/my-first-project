# 施工排期：OpenAPI 集成

## 后端任务（backend 子仓）

- [x] 1. 引入 springdoc 依赖
  - **文件**: `backend/pom.xml`
  - **操作**: 增加 `springdoc-openapi-starter-webmvc-ui`（2.8.8；本地仓库已缓存，兼容 Spring Boot 3.5）
  - **验证**: `mvn -q -DskipTests compile` 通过

- [x] 2. 分层配置 Swagger UI 可见性
  - **文件**: `backend/src/main/resources/application.yml`（含 `prod` profile 段）
  - **操作**: 默认启用 `springdoc.api-docs` / `swagger-ui`；`prod` profile 下关闭
  - **验证**: 任务 4 的测试覆盖

- [x] 3. 为 AuthController / HelloController 补 OpenAPI 注解
  - **文件**: `backend/src/main/java/com/mooc/backend/auth/api/AuthController.java`、`HelloController.java`
  - **操作**: 补 `@Operation` / `@ApiResponse`，标注四态 `200/401/403/423`、`202/409/429` 与统一错误信封；响应 schema 复用既有白名单 DTO（不改语义）
  - **注意**: 错误响应由 `GlobalExceptionHandler` 产出，springdoc **不会自动感知**，四态与 `429` 必须在此手工标注（已知残余缺口，见 design.md）
  - **验证**: `mvn test` 通过；`/v3/api-docs` 中 `login` 端点含 `200/401/403/423` 四项响应

- [x] 4. 后端测试（TDD：先写失败测试）
  - **文件**: `backend/src/test/java/com/mooc/backend/OpenApiDocsTest.java`、`OpenApiProdProfileTest.java`
  - **操作**:
    - 默认/非 prod profile：`GET /v3/api-docs` 返回 `200`，`/swagger-ui/index.html` 可达
    - `prod` profile：`/v3/api-docs` 与 `/swagger-ui/index.html` 均返回 `404`
    - 文档 JSON 中**不**含 `passwordHash`/`salt`/`verificationCode`（任一命名形式）
  - **验证**: `mvn test` 全绿（全量 157 tests，0 failures）
  - **实现期发现（已修）**: prod 下禁用 springdoc 后，请求落到 Spring Boot 默认静态资源处理器并抛 `NoResourceFoundException`（Spring Framework 6.2 起的行为），被兜底 `@ExceptionHandler(Exception.class)` 吞成 **500**。已在 `GlobalExceptionHandler` 显式处理该异常 → 404。此为既存缺陷（任意未知路径原均返回 500），本次一并修正

## 前端任务（frontend 子仓）

- [x] 5. 安装 devDeps
  - **文件**: `frontend/package.json`
  - **操作**: 安装 `openapi-typescript`(`7.13`)、`msw`(`2.15`)
  - **验证**: `node_modules` 对应包存在；`npm run type-check` 通过

- [x] 6. 落地 openapi.json 快照
  - **文件**: `frontend/openapi/openapi.json`（14767 字节）
  - **操作**: 启动后端后执行 `npm run openapi:sync`，提交快照
  - **验证**: 含 `/api/auth/*` 与 `/api/hello`；含 `200/401/403/423` 四态标注；**不含** `passwordHash`/`salt`/`verificationCode`

- [x] 7. 新增 npm scripts
  - **文件**: `frontend/package.json`
  - **操作**: 增加 `openapi:sync`、`openapi:gen`、`openapi:drift`
  - **验证**: 三个脚本均可执行（`sync` 与 `drift` 已实测通过）

- [x] 8. 生成类型文件
  - **文件**: `frontend/lib/api.generated.ts`（生成，禁止手改；20384 字节）
  - **操作**: `npm run openapi:gen`
  - **验证**: 文件生成；`npm run type-check` 通过

- [x] 9. 实现 BFF 薄类型层（方案 A：复用既有传输层）
  - **文件**: `frontend/lib/backend.ts`、`lib/auth/api.ts`、`lib/auth/types.ts`
  - **操作**: `backend.ts` 委托既有 `createAuthClient` 承担传输（**不**重写续期重放 / 空响应体 / 网络错误区分），导出 `fetchFromBackend` 与由 `components["schemas"]` 派生的 DTO；`auth/api.ts` 用生成类型约束入参；`auth/types.ts` 的 `UserResponse`/`AuthTokenResponse` 改为从契约派生，删除手写重复 DTO
  - **决策**: 采用方案 A。既有 `lib/auth/client.ts` 实为已实现的 BFF 薄层（`project.md`「BFF 尚未实现」的描述已过期），新建独立传输层会制造第二套 HTTP 栈，违反 DRY
  - **范围修正**: **移除**「替换首页 Hero 占位回调」。该占位是 `search/ai` change 预留的搜索 UI 交互，后端无对应端点，现在替换等于凭空造功能（违反 YAGNI）。spec 中已改为注明届时接入 BFF
  - **验证**: `npm run type-check` 通过；`npm test` 全绿（93 tests / 11 files）

- [x] 10. BFF 单元测试（TDD：先写失败测试）
  - **文件**: `frontend/lib/backend.test.ts`
  - **操作**: 用 MSW 拦截，断言 `fetchFromBackend` 对 `200/401/403/423/429` 的解析与错误信封透传、204 空响应体返回 `undefined`
  - **验证**: `npm test` 全绿（本文件 8 tests）

- [x] 11. MSW handlers 覆盖四态 + 限流
  - **文件**: `frontend/test/mocks/handlers.ts`、`frontend/test/mocks/server.ts`、`vitest.setup.ts`
  - **操作**: 基于生成类型手写 handler，覆盖 `ACTIVE`/`LOCKED`(含 `retryAfterSeconds`)/`DELETED`/`EMAIL_UNVERIFIED`/`INVALID_CREDENTIALS`/`429`；`vitest.setup.ts` 托管 `listen`/`resetHandlers`/`close`，`onUnhandledRequest: "error"` 防请求漏网
  - **验证**: 被 BFF 测试复用；`npm test` 全绿（93 tests）

- [x] 12. 弃用 Prism（实测不可用）+ 修正契约 content type
  - **决策**: 实测 Prism 无法消费本契约——`Accept: application/json` 返回 **406**、`Accept: */*` 返回 **500**（`Cannot find serializer for */*`）；且它作为无状态成功样例 mock，无法产出前端依赖的错误分支（401/403/423/429）。已卸载 `@stoplight/prism-cli`（移除 153 包）并删除 `mock:server` 脚本
  - **附带修复（与 Prism 无关，本身即契约质量问题）**: 后端 `AuthController` / `HelloController` 补 `produces = MediaType.APPLICATION_JSON_VALUE`，把响应 content type 由通配符修正为 `application/json`
  - **验证**: `openapi.json` 中通配符出现次数为 **0**；后端 `mvn test` 全绿（157 tests）

- [x] 13. 契约保障（drift check + 类型编译校验）
  - **文件**: `frontend/scripts/sync-openapi.mjs`、`package.json`（`openapi:drift`）、`README.md`
  - **操作**: `openapi:drift` 起后端重新导出 `/v3/api-docs`，与进仓快照做**确定性内容比对**，不一致即 exit 1
  - **实现偏差**: 采用脚本内内容比对而非原定的 `git diff --exit-code`——自包含、不依赖 git、未被跟踪的文件也能校验，且同为确定性零误报
  - **交付说明**: 本仓库无 CI（无 `.github/workflows`），按决策**不**新增 CI 设施；README 已写明接入方式，待引入 CI 时直接接线
  - **说明**: 行为正确性由既有 `AuthFlowIntegrationTest` 保证，不由 mock 工具重复校验
  - **验证**: `npm run openapi:drift` 实测通过（一致时 exit 0）

## 跨仓 / 规格任务

- [x] 14. 新增 capability spec（由 archive 产出，已落地）
  - **文件**: `openspec/specs/openapi-integration/spec.md`
  - **操作**: 由 `/opsx:archive` 把 change 的 spec delta 合入 capability 主索引；**不**手动创建——手动创建会与主索引的 `Purpose` / `Requirements` 结构不一致
  - **验证**: archive 后 `openspec/specs/openapi-integration/spec.md` 存在且含本次全部 Requirements

- [x] 15. 更新项目技术栈表
  - **文件**: `openspec/project.md`
  - **操作**: 技术栈表新增「API 契约」「前端 mock」两行；并**修正**「BFF 调用：尚未实现」这一过期描述（`lib/auth/client.ts` 实为已落地的 BFF 薄层，本次补上类型层并收敛为单一 HTTP 栈）
  - **验证**: 描述与实现一致

- [x] 16. 归档变更
  - **操作**: 走 `/opsx:archive` 将 `openspec/changes/openapi-integration/` 移入 `archive/`
  - **验证**: 父仓同步子仓指针并 commit
