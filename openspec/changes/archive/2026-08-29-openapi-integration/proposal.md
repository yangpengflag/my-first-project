# Proposal: OpenAPI 集成（文档 + 类型安全 BFF + 契约/Mock 测试）

## Why

当前后端（Spring Boot 3.5.16）已实现 `AuthController`（10 个端点）与 `HelloController`，但：

- **无机器可读的 API 描述**：联调靠口口相传，前端只能手写 DTO，与后端极易漂移。
- **前端 BFF 层缺失**：`frontend/lib/backend.ts` 在 `openspec/project.md` 中明确标为「尚未实现」，首页 Hero 仍用占位回调。
- **测试依赖真实后端**：前端单测/组件测、Playwright e2e 都需要后端起服，CI 脆弱且慢。

引入 OpenAPI，以一份进仓的 `openapi.json` 为**单一机器契约源**，同时驱动三处消费端：

1. 后端 `springdoc` 产出可交互 Swagger UI 文档；
2. 前端 `openapi-typescript` 生成类型 → 类型安全地补上 BFF；
3. 同一份 spec 驱动 `msw`（单测 / 组件测 Mock）；契约保障由确定性的 `openapi:drift` 承担。

结果：「后端 Java 类型」自动投影到「前端 TypeScript 类型」，零手写 DTO、零文档/代码双维护；并顺手把 spec 里最大的缺口（BFF）一举打通。

## What Changes

### 模块边界（Out of Scope）

- ❌ **契约优先（contract-first）**：不手写 `openapi.yaml` 作为真相源；以 Java 注解 + `springdoc` 为运行时真相源，避免与既有隐含契约重复维护（YAGNI）。
- ❌ **对外公开开发者门户**：本期 Swagger UI 仅面向内部/开发环境，不做公开文档站。
- ❌ **为非 auth 模块补全 OpenAPI**：本期仅覆盖已实现的 `AuthController` + `HelloController`；`city` / `story` / `spot` 等随各自 change 自然并入。
- ❌ **引入 React Query / axios**：保持 thin-BFF 理念，前端继续用原生 `fetch` 封装（与 `auth-frontend` spec 一致）。
- ❌ **引入 e2e mock 服务（如 Prism）**：实测其无法消费本契约（响应 content type 协商失败），且作为无状态成功样例 mock 无法产出前端依赖的错误分支；端到端保真度由既有真实后端 E2E 提供，分支覆盖由 MSW 承担（详见 design.md「已否决方案」）。
- ❌ **改动任何业务/认证语义**：仅加文档与类型投影，不触碰四态响应、限流、凭证安全边界。

### 后端变更（backend 子仓）

- `pom.xml` 增加 `springdoc-openapi-starter-webmvc-ui`（兼容 Spring Boot 3.5 的 2.8.x）。
- 为 `AuthController` 关键响应补充 `@Operation` / `@ApiResponse`：四态 `200/401/403/423`、`202/409/429`、且文档**不**含凭证字段。
- Swagger UI 仅在**非 `prod`** profile 启用（`prod` 下关闭 `/v3/api-docs` 与 `/swagger-ui.html`）。
- Controller 补 `produces = MediaType.APPLICATION_JSON_VALUE`：否则 springdoc 会把响应 content type 推断为通配符，契约不精确、消费方无法正确解析。
- 提供导出步骤，将运行中的 `/v3/api-docs` 落地为 `openapi.json` 快照提交进 frontend 子仓。

### 前端变更（frontend 子仓）

- 新增 `frontend/openapi/openapi.json`（进仓快照，单一机器契约源）。
- 安装 devDeps：`openapi-typescript`、`msw`。
- npm scripts：`openapi:sync`（刷新快照）、`openapi:gen`（生成类型）、`openapi:drift`（契约漂移检查）。
- 实现 `lib/backend.ts`（BFF 薄类型层）：用生成类型封装 `fetchFromBackend`，**传输委托既有 `lib/auth/client.ts`**——不重复实现续期重放 / 空响应体 / 网络错误区分。
- `lib/api.generated.ts`：由 `openapi-typescript` 生成，**禁止手改**。
- `lib/auth/types.ts` 的 DTO 改为从契约派生，删除手写重复定义。
- MSW handlers（`test/mocks/`）：由 `openapi.json` 派生，显式覆盖四态与 `429` 边界。
- README 补充 OpenAPI 工作流与 drift check 的 CI 接入方式（本仓库暂无 CI，故只交付 npm script）。

### 规格变更

- 新增 `openspec/specs/openapi-integration/spec.md`（capability 主索引）。
- `openspec/project.md` 技术栈表补充 OpenAPI 工具链一行。

## Impact

- **后端**：新增 1 个依赖；新增若干注解；Swagger UI 路由（仅 dev）。无认证/业务语义改动。
- **前端**：新增 2 个 devDeps（`openapi-typescript`、`msw`）；新增 `openapi/`、`scripts/sync-openapi.mjs`、`lib/api.generated.ts`、`lib/backend.ts`、`test/mocks/`。
- **跨仓耦合**：后端 API 变更后需重新导出 `openapi.json` 并提交 frontend 子仓（tasks 中列为显式步骤）。
- **与 OpenSpec 关系**：`auth-module` 等 capability spec 是人读需求契约；`openapi.json` 是机读接口契约，二者层次不同不冲突；API 行为变更时两处同步更新。

## Open Questions

- [x] 动机范围：文档 + 类型安全 BFF + 契约/Mock（用户选 3）
- [x] 类型工具：`openapi-typescript`（贴合 thin-BFF，零运行时依赖）
- [x] 契约源：Java 注解 + springdoc 为真相源，提交 `openapi.json` 快照进仓（离线 codegen）
- [x] Mock 工具：**仅 MSW**（单测 / 组件测），handlers 由 `openapi.json` 派生；不引入 e2e mock 服务
- [x] 契约保障：`openapi:drift`（重新导出 spec 与进仓快照做**内容比对**）——确定性、零误报、不依赖 git
- [x] 否决 contract-first：API 已实现且已有 `AuthFlowIntegrationTest`，手写 yaml 属纯重复 + 双真相源
- [x] 否决 Prism（e2e mock）：实测无法消费本契约（406/500），且作为无状态成功样例 mock 不覆盖错误分支
- [x] 导出时机：手动 `openapi:sync` 脚本显式刷新并提交（不自动提交，避免跨仓提交耦合）
- [x] 安全：Swagger UI 仅非 prod 启用；文档不含凭证字段（由白名单 DTO 结构保证）
