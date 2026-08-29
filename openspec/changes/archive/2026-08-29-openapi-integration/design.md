# 技术设计：OpenAPI 集成

## 架构概览

```
后端 Java 注解 ──springdoc 扫描──▶ 运行时 /v3/api-docs (+ /swagger-ui.html, 仅非 prod)
                                      │
                                openapi:sync（手动脚本，启后端后执行）
                                      ▼
                    📦 frontend/openapi/openapi.json   ← 单一机器契约源，进仓
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
     openapi-typescript                                  msw (handlers)
      → lib/api.generated.ts                             → test/mocks/handlers.ts
              │                                               │
              ▼                                               ▼
      lib/backend.ts（BFF 薄类型层）                    Vitest 单测 / 组件测
                                                        （拦截 fetch，无后端）

契约保障：openapi:drift ── 重新导出 spec 与进仓快照做**确定性内容比对**，不一致即红灯
```

一份 spec 同时产出 **类型** 与 **mock**，彻底消灭「前端手写 DTO + 文档/代码两处维护」。

契约保障由 `openapi:drift` 承担（确定性、零误报）。原计划的 `@stoplight/prism-cli` 已实测否决——详见「已否决方案」。

## 技术决策

| 决策项 | 选择 | 理由 | 替代方案 |
|--------|------|------|----------|
| 文档产出 | `springdoc-openapi-starter-webmvc-ui` 2.8.x | 与 Spring Boot 3.5 兼容、注解驱动零改造 | 手写 `openapi.yaml` |
| 类型生成 | `openapi-typescript` | 仅出 `.ts` 类型，契合 thin-BFF，零运行时依赖 | `orval`（引 react-query/axios）、`openapi-generator`（重/JVM） |
| 契约源 | Java 注解 + springdoc（运行时）→ 提交 `openapi.json` 快照 | 单一真相源、离线 codegen、避免双维护 | contract-first `openapi.yaml` |
| 单测 Mock | `msw` + 手写 handlers（由 `openapi.json` 派生） | 精确覆盖四态 / `429` 边界 | 仅 auto-mock（只返 happy path） |
| 安全 | Swagger UI 仅非 `prod` | 不暴露攻击面 | 全局开启 |
| 导出时机 | 手动 `openapi:sync` 提交快照 | 避免跨仓自动提交耦合，低成本跟随后端增长 | CI 自动生成/提交 |
| 契约保障 | `openapi:drift`（重新导出 spec 与进仓快照做**内容比对**） | 确定性、零误报，直接命中「快照忘了刷」这一真实失效模式；脚本自包含、不依赖 git | `git diff --exit-code`（依赖 git 与暂存区）、Prism 契约校验（易误报） |
| e2e mock | **不引入**（原计划 Prism，已实测否决） | 真实后端 E2E 已提供端到端保真度；四态与限流分支由 MSW 在单测层覆盖，无需第二套 mock | `@stoplight/prism-cli`（无法消费本契约，且不覆盖错误分支） |

## 后端设计

### 依赖与配置

- `backend/pom.xml` 新增：

  ```xml
  <dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.8.0</version>
  </dependency>
  ```

  版本在 `properties` 中固化，实施时以「能匹配 Spring Boot 3.5.16 的 2.8.x」为准并验证。

- `application.yml` 分层配置：

  ```yaml
  springdoc:
    api-docs:
      enabled: true          # 非 prod 默认开
    swagger-ui:
      enabled: true
  ---
  spring:
    config:
      activate:
        on-profile: prod
  springdoc:
    api-docs:
      enabled: false
    swagger-ui:
      enabled: false
  ```

### 注解补强（不改语义）

- 为 `AuthController` 端点补 `@Operation` + `@ApiResponse`：
  - `register` → `201`；`409 EMAIL_ALREADY_REGISTERED`；`400 VALIDATION_FAILED`
  - `login` → `200`；`401 ACCOUNT_DELETED` / `INVALID_CREDENTIALS`；`403 EMAIL_NOT_VERIFIED`；`423 ACCOUNT_LOCKED`
  - `forgot-password` / `resend-verification` → `202`（恒定，防枚举）
  - `reset-password` → `200`；`400 INVALID_RESET_CODE`；`429 RATE_LIMITED`
  - `verify` → `200`；`400 INVALID_VERIFICATION_CODE`
  - `refresh` / `me` / `logout` / `delete-me` 的鉴权与四态响应同样标注
- 响应 schema 直接复用既有的白名单 DTO（`UserResponse` / `AuthTokenResponse` 等），**凭证字段（passwordHash/salt/verificationCode…）因 DTO 白名单天然不出网**。

### 导出 `openapi.json`

- 提供 `frontend/scripts/sync-openapi.mjs`：`curl -s http://localhost:8080/v3/api-docs -o frontend/openapi/openapi.json`；或在 README 写明手动命令。
- 该快照**进仓**于 `frontend/openapi/openapi.json`，使前端 codegen 与 msw 全部离线可用。

## 前端设计

### 生成与 BFF

- `openapi:gen` 脚本：

  ```jsonc
  "openapi:sync": "node scripts/sync-openapi.mjs",
  "openapi:gen": "openapi-typescript ./openapi/openapi.json -o ./lib/api.generated.ts"
  ```

- `lib/api.generated.ts` 由 `openapi:gen` 生成，**禁止手改**；CI 中若检测到手改/过期则红灯。
- `lib/backend.ts`（BFF）用生成类型实现 `fetchFromBackend(path, init)`，仅负责拼接请求、传递 Bearer 令牌、解析统一错误信封（`auth-frontend` spec 定义的 `error.code` 分支在调用方处理，BFF 不实现业务逻辑）。

### MSW（单测 / 组件测）

- `test/mocks/handlers.ts`：从 `api.generated.ts` 的类型派生请求/响应形状，**手写**关键边界 handler：
  - `ACTIVE` → `200` + 令牌
  - `LOCKED` → `423 ACCOUNT_LOCKED`
  - `DELETED` → `401 ACCOUNT_DELETED`
  - `EMAIL_UNVERIFIED` → `403 EMAIL_NOT_VERIFIED`
  - `INVALID_CREDENTIALS` / `429 RATE_LIMITED`
- Vitest `setup` 中 `setupServer(...handlers)` 拦截 `fetch`，使组件/单测无需真实后端。

### Drift check（契约保障）

- `openapi:drift` 脚本：启动后端 → 导出 `/v3/api-docs` → 与进仓的 `frontend/openapi/openapi.json` 做**确定性内容比对**，不一致即 exit 1。
- 采用内容比对而非 `git diff --exit-code`：脚本自包含、不依赖 git 与暂存区，且同样零误报。
- 三层保障的边界（避免重复建设）：

| 层 | 手段 | 状态 |
|---|---|---|
| 行为正确性 | `backend/.../AuthFlowIntegrationTest`（真实 HTTP，覆盖四态与正反路径） | 既有，**不新增** |
| 快照新鲜度 | `openapi:drift`（重新导出 + 内容比对） | 本次新增 |
| 结构破坏性变更 | `openapi:gen` + `npm run type-check` 编译期捕获 | 已有 |

> **交付形态**：本仓库无 CI（无 `.github/workflows`），故 drift check 以 npm script 交付，
> README 已写明接入方式；将来引入 CI 时直接调用 `npm run openapi:drift` 即可，无需改动实现。

### e2e mock：不引入

原计划的 `@stoplight/prism-cli` e2e 运行档已**实测否决并移除**（详见「已否决方案」）。
既有的真实后端 E2E（`auth-flow.spec.ts`）提供端到端保真度，四态与限流分支由 MSW 在单测层覆盖，
二者已形成互补，无需第二套 mock。

## 已否决方案（含理由）

| 方案 | 否决理由 |
|---|---|
| **contract-first**（手写 `openapi.yaml` 为真相源） | API 已实现（`AuthController` 10 端点）且已有 `AuthFlowIntegrationTest` 覆盖行为，手写 yaml 属**纯重复**；会形成「yaml + Java 代码」双真相源，改 API 需改两处，漂移风险最高。其唯一价值（前端先于后端开发）可用「stub controller + springdoc」更省地达成——同样能立刻产出 spec，且不必维护两份契约 |
| **Prism 契约校验**（比对后端实际响应与 spec） | 后端行为契约已由 `AuthFlowIntegrationTest` 断言，Prism 校验仅**多**覆盖「文档是否与行为一致」一层；而 Prism 严格模式对未文档化响应头 / content-type / 动态响应敏感，误报噪声大，属典型高维护成本组件。改用确定性 `openapi:drift` 直接命中真实失效模式 |
| **Prism 作为 e2e mock**（实测后否决） | 实测无法消费本契约：`Accept: application/json` → **406**、`Accept: */*` → **500**（`Cannot find serializer for */*`）。根因是 springdoc 把响应 content type 推断为通配符。更关键的是：即便修好，Prism 作为**无状态成功样例 mock** 默认只返回首个 2xx，无法产出前端依赖的错误分支（401/403/423/429）——要拿 401 需发 `Prefer: code=401` 头，而前端不会发。叠加真实后端 E2E 与 MSW 后，其边际收益仅剩「无后端跑 UI 冒烟」，不值得再维护一套配置与用例。已卸载依赖并移除 `mock:server` 脚本 |

> **残余缺口（已知并接受）**：错误响应由 `GlobalExceptionHandler`（`@RestControllerAdvice`）产出，springdoc **不**自动感知，四态与 `429` 依赖手工 `@ApiResponse` 标注。
> 影响有限：前端依赖的是统一错误信封 `error.code`（`auth-frontend` spec 已定义），不依赖逐状态码的精确类型；行为本身由后端集成测试保证。

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| springdoc 版本与 Spring Boot 3.5.16 不兼容 | 构建/启动失败 | 实施时锁定 2.8.x 并跑通 `mvn test` |
| `openapi.json` 与后端漂移 | 前端类型/契约失真 | `openapi:drift` 确定性拦截（重新导出 + 内容比对）+ tasks 中显式刷新步骤 |
| 响应 content type 被推断为通配符 | 契约不精确，按 media type 协商的消费方无法解析（实测 Prism 即因此完全不可用） | Controller 显式声明 `produces = MediaType.APPLICATION_JSON_VALUE`；已验证快照中通配符出现次数为 **0**，新增 Controller 时须沿用 |
| 错误路径未标注致文档失真 | 前端拿到的状态码类型不全 | task 3 明确标注四态与 `429` 的 `@ApiResponse`；残余影响由统一错误信封 `error.code` 兜底，行为由后端集成测试保证 |
| Swagger UI 误暴露生产 | 攻击面摊开 | profile 隔离 + 测试断言 prod 下 `/v3/api-docs`、`/swagger-ui.html` 不可达 |
| 凭证字段泄露到文档 | 安全边界破坏 | 依赖既有白名单 DTO，springdoc 读同一 DTO；加测试断言文档不含凭证键 |
| 跨仓提交耦合 | 后端改了前端不知 | README + tasks 显式要求「API 变更 → 重新 `openapi:sync` → 提交 frontend 子仓」 |
