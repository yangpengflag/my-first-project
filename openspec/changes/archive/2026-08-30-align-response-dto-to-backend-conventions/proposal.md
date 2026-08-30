## Why

`backend-conventions.md`（always-on 约束）要求 Response DTO 继承 `BaseResponse`（自带 `request_id`）、字段用 `@JsonProperty("snake_case")`、immutable，并存在 `RequestIdFilter` 注入请求级 UUID。但当前 backend 完全偏离：

- `BaseResponse` 全仓搜索为 **0**（类不存在）；
- `UserResponse` / `PostResponse` / `PostSummary` / `AuthTokenResponse` / `ErrorResponse` 均为 record、无基类、camelCase；
- `RequestIdFilter` / `requestId` / `MDC` 全仓搜索为 **0**（跨切关注点未落地）；
- 上一轮 `align-soft-delete-to-db-conventions` 将此项列为 task 10.2 独立 concern。

用户决策：拆成独立第二个 change，`snake_case + request_id + BaseResponse` 为权威项 → **强制改代码 + 重新生成 `frontend/openapi.json`**。当前无前端消费方，是执行契约变更成本最低的窗口。

## What Changes

- **新增 `BaseResponse`**（`dto/response/BaseResponse.java`）：`request_id` 字段，`BaseResponse` 构造时从 `MDC` 读取（由 `RequestIdFilter` 注入）。
- **新增 `RequestIdFilter`**（`common/filter/RequestIdFilter.java`）：每请求生成 UUID → request attribute + `MDC.put("requestId", …)`，响应后清理。
- **5 个 Response DTO record → class extends BaseResponse**，字段转 `snake_case`（显式 `@JsonProperty`），`private final` + 构造器 + getter；`WHITELISTED_FIELDS` 同步（含 `request_id`）；`from(...)` 签名不变。
  - `auth/api/UserResponse.java`、`auth/api/AuthTokenResponse.java`、`posts/api/PostResponse.java`、`posts/api/PostSummary.java`、`auth/api/ErrorResponse.java`
- **序列化测试对齐**：record 访问器改 getter；测试 setup 固定 `MDC` 的 `requestId`；白名单断言随 snake_case 更新。
- **重新生成 `frontend/openapi/openapi.json`**（后端 JDK 17 启动 + `npm run openapi:sync`）。
- **specs 响应侧同步**：`posts` / `auth-module` / `auth-frontend` 响应字段名改 snake_case + 信封补 `request_id`；请求侧字段保持 camelCase。
- **修正 `backend-conventions.md`** 过时包布局（`entity/`/`dto/` → `domain/`/`api/`，`BaseResponse` 共享于 `dto/response/`），并补全 `RequestIdFilter` 落地说明。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `posts`：响应 DTO 形态对齐（snake_case + `request_id` 信封），spec 白名单同步。
- `auth-module`：响应 DTO 形态对齐，spec 白名单与信封描述同步。
- `auth-frontend`：仅响应侧字段名同步（请求侧不变）。

## Impact

- **契约（BREAKING）**：所有成功/错误响应字段由 camelCase 转 snake_case，并新增顶层 `request_id`。`frontend/openapi.json` 重新生成反映此变化。
- **前端影响**：当前无消费方（`lib/auth/client.ts` 已落地但首页未接入）；`lib/api.generated.ts` 为 openapi 生成物、禁止手改，将随快照更新。未来前端 change（如 `hot-posts`）直接消费 snake_case 字段，无需返工。
- **后端影响**：`BaseResponse` + `RequestIdFilter` 新增；5 个响应 DTO 由 record 变 class（所有 `.id()`/`.email()` 等访问器调用点改 `.getId()`/`.getEmail()`，靠 `mvn test` 编译报错定位）。
- **数据库**：无影响。
- **测试**：序列化白名单护栏、若干 service/controller 集成测试需随 record→class 与字段名调整。

## 不在本 change 范围（需单独决策）

- Request DTO 形态（已是 record + 校验 + camelCase，符合规约，不改）。
- 将 Response DTO 物理搬入共享 `dto/` 包（保持模块化 `api/`，仅 doc 描述修正）。
- service→controller 的 DTO 构造职责重构（本 change 不改分层选择，`request_id` 经 MDC 注入）。
