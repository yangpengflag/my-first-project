# openapi-integration Specification

## Purpose

将后端 `springdoc` 产出的 OpenAPI 3 契约，作为**单一机器契约源**驱动前端：生成类型安全的 BFF 薄层（`lib/api.generated.ts` + `lib/backend.ts`）、派生 MSW 单测 mock、并以确定性的 `openapi:drift` 保障契约新鲜度。

本 capability 解决的真实问题：

- 前端此前 `lib/auth/types.ts` 手写 DTO 与后端契约两处维护、易漂移；
- BFF 层在 `lib/auth/client.ts` 已实现却未在 `openspec/project.md` 记录，形成隐性技术债；
- 缺少「后端改了但前端快照忘了刷」的确定性拦截手段。

非目标：contract-first 手写 yaml、对外公开开发者门户、为非 auth 模块补全 OpenAPI、引入第二套 HTTP 传输或 e2e mock（如 Prism）。
## Requirements
### Requirement: 后端产出 OpenAPI 文档

后端 SHALL 通过 `springdoc-openapi` 在运行时暴露机器可读的 API 描述（`/v3/api-docs`，OpenAPI 3 JSON）与可交互文档（`/swagger-ui.html`）。该文档 SHALL 由 Java 注解（Controller / DTO）自动生成，作为前端 codegen 与 Mock 的**单一运行时真相源**。

> **决策**：采用 code-first（注解驱动），不手写 `openapi.yaml`。避免与既有隐含契约重复维护，符合 YAGNI。

#### Scenario: 非 prod 环境下可访问文档

- **WHEN** 以非 `prod` profile 启动后端
- **THEN** `GET /v3/api-docs` 返回 `200` 且为合法 OpenAPI 3 JSON
- **AND** `GET /swagger-ui.html` 可访问

#### Scenario: 文档覆盖认证端点与四态响应码

- **WHEN** 查看 `/v3/api-docs`
- **THEN** 含 `/api/auth/*` 全部路径（register / login / verify / resend-verification / forgot-password / reset-password / refresh / logout / GET|DELETE /me）
- **AND** `login` 等端点标注四态响应 `200` / `401` / `403` / `423` 及 `202` / `409` / `429`

> 错误响应由 `GlobalExceptionHandler` 产出，springdoc **不**自动感知；四态与 `429` 依赖 `@ApiResponse` 手工标注（已知残余缺口，由统一错误信封兜底）。

#### Scenario: 文档不含凭证字段

- **WHEN** 序列化任意响应 schema 进入文档
- **THEN** 文档 JSON 中**不**出现 `passwordHash` / `salt` / `verificationCode` 任一命名形式（依赖白名单 DTO 结构保证）

---

### Requirement: 前端类型安全 BFF

前端 SHALL 从进仓的 `openapi.json` 快照经 `openapi-typescript` 生成 `lib/api.generated.ts` 类型，并 SHALL 实现 `lib/backend.ts`（BFF）以生成类型封装后端调用，从而补上 `openspec/project.md` 中「尚未实现」的 BFF 层。BFF SHALL 仅负责拼接请求、传递 Bearer 令牌、透传统一错误信封，**不**实现任何业务逻辑。

#### Scenario: 生成类型与后端契约一致

- **GIVEN** `frontend/openapi/openapi.json` 由后端 `/v3/api-docs` 导出并提交
- **WHEN** 执行 `npm run openapi:gen`
- **THEN** 生成 `frontend/lib/api.generated.ts`
- **AND** 该文件**禁止手改**（CI 校验过期即红灯）

#### Scenario: BFF 用生成类型封装请求

- **WHEN** 前端调用 `fetchFromBackend('/api/auth/login', ...)`
- **THEN** 请求/响应类型由 `api.generated.ts` 推导，编译期捕获字段错位
- **AND** BFF 仅传递 `Authorization` 头并透传 `error.code`，不判断用户状态

#### Scenario: 传输逻辑不重复实现

- **WHEN** 前端发起任意后端调用
- **THEN** 传输职责（Bearer 注入 / 401 静默续期重放 / 空响应体处理 / 网络层失败与业务错误的区分）由既有传输层承担，`lib/backend.ts` **只**叠加类型约束
- **AND** 全项目仅存在一套 HTTP 传输实现——出现第二套即视为违反 DRY 的缺陷

> **决策依据**：既有的 `lib/auth/client.ts` 实为已实现的 BFF 薄层（`openspec/project.md` 中「BFF 尚未实现」的描述已过期）。新建独立传输层会重写已跑通的续期重放、空响应体与网络错误区分逻辑，收益仅是文件名变为 `backend.ts`，风险却显著更高。

#### Scenario: 首页搜索占位回调保留至 search/ai change

- **WHEN** 渲染首页 Hero
- **THEN** 搜索交互沿用占位回调（后端当前**无**搜索端点，仅有 `/api/hello` 与 `/api/auth/*`）
- **AND** 该占位在 `search/ai` change 接入时改为经 `lib/backend.ts` 调用

> **范围修正**：原 draft 要求「替换 Hero 占位回调」，实现期发现该占位是 `search/ai` change 预留的搜索 UI 交互，无对应后端端点。若强行接线等于凭空造功能，违反 YAGNI，故移除该项。

---

### Requirement: 前端单测 Mock（MSW）

前端单测与组件测 SHALL 通过 `msw` 拦截 `fetch`，handler SHALL 由 `openapi.json` / 生成类型派生，并 SHALL 显式覆盖认证四态（`ACTIVE`→`200`、`LOCKED`→`423`、`DELETED`→`401`、`EMAIL_UNVERIFIED`→`403`）及 `INVALID_CREDENTIALS` / `429 RATE_LIMITED`。测试 SHALL NOT 依赖真实后端起服。

#### Scenario: 单测不依赖真实后端

- **GIVEN** Vitest `setup` 中 `setupServer(...handlers)` 已启用
- **WHEN** 运行组件/单测中发起 API 调用
- **THEN** 请求被 MSW 拦截并返回预设响应，无网络请求发出

#### Scenario: 四态响应可模拟

- **WHEN** 测试分别设定 `LOCKED` / `DELETED` / `EMAIL_UNVERIFIED` 的 mock 响应
- **THEN** 前端按 `error.code` 渲染对应状态（锁定倒计时 / 注销提示 / 验证邮箱出口）

#### Scenario: 429 限流可模拟

- **WHEN** mock 返回 `429 RATE_LIMITED`
- **THEN** 前端展示「操作过于频繁」，不误判为「邮箱或密码错误」

---

### Requirement: 契约保障（Drift Check）

契约保障 SHALL 由确定性的 `openapi:drift`（重新导出 spec 与进仓快照做内容比对）与 `openapi:gen` + 类型检查共同承担：快照过期或破坏式 API 变更即红灯。系统 SHALL NOT 引入无状态成功样例 mock（如 Prism）承担 e2e 或契约校验职责。

> **已否决 Prism**：实测其无法消费本契约（`Accept: application/json` → 406、`Accept: */*` → 500），
> 且作为无状态成功样例 mock 默认只返回首个 2xx，无法产出前端依赖的错误分支（401/403/423/429）。
> 端到端保真度由既有真实后端 E2E 提供，分支覆盖由 MSW 在单测层提供，二者已互补。

#### Scenario: 快照漂移被拦截

- **GIVEN** 后端改动了某端点响应结构，但**未**执行 `openapi:sync` 刷新快照
- **WHEN** 执行 `openapi:drift`：起后端重新导出 `/v3/api-docs`，与进仓的 `frontend/openapi/openapi.json` 做内容比对
- **THEN** 判定不一致，进程以非零码退出（接入 CI 后即红灯）
- **AND** 该检查为确定性内容比对，零误报，且**不**依赖 git 与暂存区

#### Scenario: 破坏式 API 变更被拦截

- **GIVEN** 后端改动了某端点响应结构**且已刷新**快照
- **WHEN** 执行 `openapi:gen` 后跑 `npm run type-check`
- **THEN** 前端对变更字段的类型引用失配，编译期红灯
- **AND** 行为层面的四态响应正确性由既有 `AuthFlowIntegrationTest` 断言，**不**由 mock 工具重复校验

---

### Requirement: 安全与暴露面

Swagger UI SHALL 仅在非 `prod` 环境启用，`prod` profile 下 `/v3/api-docs` 与 `/swagger-ui.html` SHALL 不可达。生成的文档 SHALL NOT 包含任何凭证类字段，且四态响应码 SHALL 在文档中正确标注。

#### Scenario: prod 下 Swagger UI 不可达

- **WHEN** 以 `prod` profile 启动后端
- **THEN** `GET /v3/api-docs` 与 `GET /swagger-ui.html` 均返回 `404` 或等价不可达
- **AND** 不泄露端点清单

#### Scenario: 文档不含凭证字段

- **WHEN** 任意 profile 下查看 `/v3/api-docs`
- **THEN** 文档中**不**出现 `passwordHash` / `salt` / `verificationCode` 任一命名形式

#### Scenario: 四态响应在文档中正确标注

- **WHEN** 查看 `login` 端点的 API 描述
- **THEN** 标注 `ACTIVE→200`、`LOCKED→423`、`DELETED→401`、`EMAIL_UNVERIFIED→403` 及对应的 `error.code`

